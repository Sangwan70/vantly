import { HttpException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';
import { PromoteRepository } from '@gitroom/nestjs-libraries/database/prisma/promote/promote.repository';
import { PromoteMedia } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

const MEDIA_CACHE_SECONDS = 60 * 60;
const MIN_POSTS_FOR_CONFIDENCE = 12;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const engagementOf = (m: PromoteMedia): number | null => {
  if (typeof m.likeCount !== 'number' && typeof m.commentsCount !== 'number') {
    return null;
  }
  return (m.likeCount ?? 0) + (m.commentsCount ?? 0);
};

const mean = (n: number[]) => (n.length ? n.reduce((a, b) => a + b, 0) / n.length : null);

@Injectable()
export class PromoteInsightsService {
  constructor(
    private _promoteService: PromoteService,
    private _promoteRepository: PromoteRepository
  ) {}

  // offsetMinutes: the viewer's UTC offset in minutes (east positive), so the
  // heatmap is in their local time rather than the server's.
  async get(org: Organization, integrationId: string, offsetMinutes: number) {
    const { integration, provider } = await this._promoteService.requireAccount(
      org,
      integrationId
    );
    if (!provider.ownMedia) {
      throw new HttpException('Posting insights are not available.', 400);
    }
    const offset = Math.max(-840, Math.min(840, Math.round(offsetMinutes || 0)));

    const media = await this.loadMedia(integration.id, () =>
      provider.ownMedia!(integration.token, integration.internalId, 100)
    );

    const competitors = await this._promoteRepository.listCompetitors(
      org.id,
      integration.id
    );

    return this.analyse(
      media,
      offset,
      competitors.map((c) => ({
        username: c.username,
        media: ((c.recentMedia as any) || []) as PromoteMedia[],
      }))
    );
  }

  private async loadMedia(
    integrationId: string,
    load: () => Promise<PromoteMedia[]>
  ): Promise<PromoteMedia[]> {
    const key = `promote:own-media:${integrationId}`;
    try {
      const cached = await ioRedis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    let media: PromoteMedia[];
    try {
      media = await load();
    } catch (e: any) {
      this._promoteService.toHttp(e);
    }
    try {
      await ioRedis.set(key, JSON.stringify(media), 'EX', MEDIA_CACHE_SECONDS);
    } catch (e) {}
    return media;
  }

  private analyse(
    media: PromoteMedia[],
    offset: number,
    competitors: { username: string; media: PromoteMedia[] }[]
  ) {
    const posts = media
      .filter((m) => m.timestamp)
      .map((m) => ({
        ts: new Date(m.timestamp as string).getTime(),
        eng: engagementOf(m),
        type: m.mediaType || 'UNKNOWN',
      }))
      .filter((p) => !isNaN(p.ts));
    const withEng = posts.filter((p) => p.eng !== null) as {
      ts: number;
      eng: number;
      type: string;
    }[];

    const local = (ts: number) => new Date(ts + offset * 60000);
    const overall = mean(withEng.map((p) => p.eng));

    // Weekday x hour grid, in the viewer's local time.
    const sums = Array.from({ length: 7 }, () => Array(24).fill(0));
    const counts = Array.from({ length: 7 }, () => Array(24).fill(0));
    const byHour = Array.from({ length: 24 }, () => ({ sum: 0, n: 0 }));
    const byDay = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }));
    for (const p of withEng) {
      const d = local(p.ts);
      const day = d.getUTCDay();
      const hour = d.getUTCHours();
      sums[day][hour] += p.eng;
      counts[day][hour] += 1;
      byHour[hour].sum += p.eng;
      byHour[hour].n += 1;
      byDay[day].sum += p.eng;
      byDay[day].n += 1;
    }
    const heatmap = sums.map((row, d) =>
      row.map((sum, h) => (counts[d][h] ? sum / counts[d][h] : null))
    );

    const lift = (avg: number) => (overall ? avg / overall : null);

    // Ranked on hour/weekday aggregates with at least 2 posts, so one lucky
    // viral post can't crown a time slot.
    const bestHours = byHour
      .map((b, hourLocal) => ({ hourLocal, ...b }))
      .filter((b) => b.n >= 2)
      .map((b) => ({
        hourLocal: b.hourLocal,
        hourUtc: (((b.hourLocal * 60 - offset) / 60) % 24 + 24) % 24,
        avgEngagement: b.sum / b.n,
        lift: lift(b.sum / b.n),
        posts: b.n,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    const bestDays = byDay
      .map((b, day) => ({ day, name: DAY_NAMES[day], ...b }))
      .filter((b) => b.n >= 2)
      .map((b) => ({
        day: b.day,
        name: b.name,
        avgEngagement: b.sum / b.n,
        lift: lift(b.sum / b.n),
        posts: b.n,
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .slice(0, 3);

    // Format performance.
    const typeMap = new Map<string, number[]>();
    withEng.forEach((p) =>
      typeMap.set(p.type, [...(typeMap.get(p.type) || []), p.eng])
    );
    const formats = [...typeMap.entries()]
      .map(([type, list]) => ({
        type,
        posts: list.length,
        avgEngagement: mean(list) as number,
        lift: lift(mean(list) as number),
      }))
      .sort((a, b) => b.avgEngagement - a.avgEngagement);

    // Cadence: posts per week over the last 12 weeks (weeks start Monday, local).
    const now = Date.now();
    const weekMs = 7 * 86400000;
    const startOfThisWeek = (() => {
      const d = local(now);
      const dow = (d.getUTCDay() + 6) % 7;
      return (
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow) -
        offset * 60000
      );
    })();
    const weeks = Array.from({ length: 12 }, (_, i) => {
      const start = startOfThisWeek - (11 - i) * weekMs;
      const inWeek = posts.filter((p) => p.ts >= start && p.ts < start + weekMs);
      const engs = inWeek.filter((p) => p.eng !== null).map((p) => p.eng as number);
      return {
        weekStart: new Date(start).toISOString(),
        posts: inWeek.length,
        avgEngagement: mean(engs),
      };
    });
    const recentWeeks = weeks.slice(0, 11); // exclude the partial current week
    const avgPerWeek = mean(recentWeeks.map((w) => w.posts)) ?? 0;

    const sorted = [...posts].sort((a, b) => a.ts - b.ts);
    let longestGapDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      longestGapDays = Math.max(
        longestGapDays,
        (sorted[i].ts - sorted[i - 1].ts) / 86400000
      );
    }

    const competitorCadence = competitors
      .map((c) => {
        const ts = c.media
          .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : NaN))
          .filter((t) => !isNaN(t));
        if (ts.length < 3) return null;
        const spanDays = Math.max((Math.max(...ts) - Math.min(...ts)) / 86400000, 1);
        return { username: c.username, perWeek: (ts.length / spanDays) * 7 };
      })
      .filter(Boolean) as { username: string; perWeek: number }[];
    const competitorAvg = mean(competitorCadence.map((c) => c.perWeek));

    // Plain-language takeaways, only from what the data actually supports.
    const notes: string[] = [];
    const enough = withEng.length >= MIN_POSTS_FOR_CONFIDENCE;
    if (!enough) {
      notes.push(
        `Only ${withEng.length} posts with engagement data so far. Treat the times below as a rough guide until you have ${MIN_POSTS_FOR_CONFIDENCE}+.`
      );
    }
    if (bestDays[0] && bestDays[0].lift && bestDays[0].lift > 1.1) {
      notes.push(
        `${bestDays[0].name} posts average ${bestDays[0].lift.toFixed(1)}x your typical engagement.`
      );
    }
    if (formats.length > 1 && formats[0].lift && formats[0].lift > 1.15) {
      notes.push(
        `${formats[0].type.replace('_', ' ').toLowerCase()} posts are your strongest format right now (${formats[0].lift.toFixed(1)}x average).`
      );
    }
    if (competitorAvg !== null) {
      if (avgPerWeek < competitorAvg * 0.7) {
        notes.push(
          `You average ${avgPerWeek.toFixed(1)} posts a week; the competitors you track average ${competitorAvg.toFixed(1)}.`
        );
      } else if (avgPerWeek > competitorAvg * 1.4) {
        notes.push(
          `You post more often than the competitors you track (${avgPerWeek.toFixed(1)} vs ${competitorAvg.toFixed(1)} a week).`
        );
      }
    }
    if (longestGapDays >= 14) {
      notes.push(
        `Your longest gap between posts was ${Math.round(longestGapDays)} days. Consistency tends to matter more than the exact hour.`
      );
    }

    return {
      sampleSize: posts.length,
      withEngagement: withEng.length,
      enough,
      from: sorted[0] ? new Date(sorted[0].ts).toISOString() : null,
      to: sorted.length ? new Date(sorted[sorted.length - 1].ts).toISOString() : null,
      avgEngagement: overall,
      heatmap,
      counts,
      bestHours,
      bestDays,
      formats,
      cadence: {
        weeks,
        avgPerWeek,
        longestGapDays,
        competitorAvgPerWeek: competitorAvg,
        competitors: competitorCadence,
      },
      notes,
    };
  }
}
