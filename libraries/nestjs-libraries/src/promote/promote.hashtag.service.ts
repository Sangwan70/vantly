import { HttpException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PromoteHashtagRepository } from '@gitroom/nestjs-libraries/database/prisma/promote/promote.hashtag.repository';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';
import { PromoteMedia } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { generationError } from '@gitroom/nestjs-libraries/openai/generation.error';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

// Meta: 30 unique hashtags per Instagram account per rolling 7 days.
export const HASHTAG_WEEKLY_LIMIT = 30;
const WINDOW_MS = 7 * 86400000;
const RESULT_TTL_MS = 24 * 3600000;
const MAX_SETS_PER_ORG = 50;

// The AI ideas reuse the existing "text suggestions" credit pool (the
// youtube_text_suggestions plan limit) rather than adding a new pricing
// column. Free plans have 0 credits, so AI ideas are a paid-plan feature.
const AI_CREDIT_TYPE = 'youtube_text_suggestions';

export const normalizeHashtag = (raw: string) =>
  raw.replace(/^#/, '').trim().toLowerCase();

const avg = (nums: number[]) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;

export type HashtagResult = {
  hashtag: string;
  topStats: { avgLikes: number | null; avgComments: number | null };
  // Posts per hour across the sample of most recent posts (last 24h only).
  postsPerHour: number | null;
  competition: 'low' | 'medium' | 'high' | 'very high' | null;
  formats: { type: string; share: number }[];
  related: { tag: string; count: number }[];
  topPosts: PromoteMedia[];
  recentPosts: PromoteMedia[];
  fetchedAt: string;
};

@Injectable()
export class PromoteHashtagService {
  constructor(
    private _repo: PromoteHashtagRepository,
    private _promoteService: PromoteService,
    private _openai: OpenaiService,
    private _subscriptionService: SubscriptionService
  ) {}

  async quota(org: Organization, integrationId: string) {
    await this._promoteService.requireAccount(org, integrationId);
    return this.quotaFor(integrationId);
  }

  private async quotaFor(integrationId: string) {
    const rows = await this._repo.windowLookups(
      integrationId,
      new Date(Date.now() - WINDOW_MS)
    );
    return {
      used: rows.length,
      limit: HASHTAG_WEEKLY_LIMIT,
      // When the oldest counted hashtag leaves Meta's window, freeing a slot.
      nextSlotAt: rows.length
        ? new Date(rows[0].windowStart.getTime() + WINDOW_MS)
        : null,
    };
  }

  async history(org: Organization, integrationId: string) {
    await this._promoteService.requireAccount(org, integrationId);
    const rows = await this._repo.history(integrationId);
    return rows.map((r) => {
      const res = r.result as any as HashtagResult | null;
      return {
        hashtag: r.hashtag,
        fetchedAt: r.fetchedAt,
        competition: res?.competition ?? null,
        avgLikes: res?.topStats?.avgLikes ?? null,
        inWindow: r.windowStart.getTime() >= Date.now() - WINDOW_MS,
      };
    });
  }

  async research(
    org: Organization,
    integrationId: string,
    rawTag: string,
    refresh = false
  ) {
    const hashtag = normalizeHashtag(rawTag);
    const { integration, provider } = await this._promoteService.requireAccount(
      org,
      integrationId
    );
    if (!provider.hashtagSearch) {
      throw new HttpException('Hashtag research is not available.', 400);
    }

    const existing = await this._repo.getLookup(integration.id, hashtag);
    const now = Date.now();
    const cached = existing?.result as any as HashtagResult | null;
    const fresh =
      !!existing && !!cached && now - existing.fetchedAt.getTime() < RESULT_TTL_MS;

    if (fresh && !refresh) {
      return { ...cached!, cached: true, quota: await this.quotaFor(integration.id) };
    }

    // A hashtag already queried inside its 7-day window costs nothing extra
    // on Meta's side; a new one (or one whose window expired) takes a slot.
    const inWindow =
      !!existing && existing.windowStart.getTime() >= now - WINDOW_MS;
    if (!inWindow) {
      const quota = await this.quotaFor(integration.id);
      if (quota.used >= HASHTAG_WEEKLY_LIMIT) {
        if (cached) {
          return { ...cached, cached: true, quota, quotaBlocked: true };
        }
        throw new HttpException(
          `Instagram allows ${HASHTAG_WEEKLY_LIMIT} new hashtags per account per week and this account has used them all. Next slot opens ${quota.nextSlotAt?.toUTCString()}.`,
          429
        );
      }
    }

    let data;
    try {
      data = await provider.hashtagSearch(
        integration.token,
        integration.internalId,
        hashtag
      );
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg === 'NO_PUBLIC_CONTENT_ACCESS') {
        throw new HttpException(
          'Instagram has not enabled hashtag research for this app yet. It needs Meta\'s "Instagram Public Content Access" approval.',
          403
        );
      }
      if (msg === 'QUOTA') {
        throw new HttpException(
          'Instagram says this account reached its weekly hashtag limit. Try again later.',
          429
        );
      }
      this._promoteService.toHttp(e);
    }

    const result = this.analyse(hashtag, data.topMedia, data.recentMedia);
    await this._repo.saveLookup(integration.id, hashtag, {
      igHashtagId: data.igHashtagId,
      result,
      windowStart: inWindow ? existing!.windowStart : new Date(),
    });

    return { ...result, cached: false, quota: await this.quotaFor(integration.id) };
  }

  private analyse(
    hashtag: string,
    top: PromoteMedia[],
    recent: PromoteMedia[]
  ): HashtagResult {
    // Pace: how fast people are posting under this tag, from the span the
    // most recent sample covers. A full sample of 25 inside a short span
    // means the tag is moving fast (and your post will sink quickly).
    let postsPerHour: number | null = null;
    const times = recent
      .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : NaN))
      .filter((t) => !isNaN(t));
    if (times.length >= 2) {
      const spanHours = Math.max(
        (Math.max(...times) - Math.min(...times)) / 3600000,
        1 / 60
      );
      postsPerHour = times.length / spanHours;
    }

    let competition: HashtagResult['competition'] = null;
    if (postsPerHour !== null) {
      competition =
        postsPerHour >= 50
          ? 'very high'
          : postsPerHour >= 10
          ? 'high'
          : postsPerHour >= 2
          ? 'medium'
          : 'low';
    }

    const typeCounts = new Map<string, number>();
    top.forEach((m) => {
      const t = m.mediaType || 'UNKNOWN';
      typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
    });
    const formats = [...typeCounts.entries()]
      .map(([type, c]) => ({ type, share: top.length ? c / top.length : 0 }))
      .sort((a, b) => b.share - a.share);

    // Related tags: other hashtags used in the same posts, once per post.
    const tagCounts = new Map<string, number>();
    [...top, ...recent].forEach((m) => {
      const found = new Set(
        (m.caption?.match(/#[\p{L}\p{N}_]+/gu) || []).map((t) =>
          t.slice(1).toLowerCase()
        )
      );
      found.delete(hashtag);
      found.forEach((t) => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    });
    const related = [...tagCounts.entries()]
      .filter(([, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag, count]) => ({ tag, count }));

    const slim = (m: PromoteMedia): PromoteMedia => ({
      ...m,
      caption: m.caption?.slice(0, 200),
    });

    return {
      hashtag,
      topStats: {
        avgLikes: avg(
          top.filter((m) => typeof m.likeCount === 'number').map((m) => m.likeCount as number)
        ),
        avgComments: avg(
          top
            .filter((m) => typeof m.commentsCount === 'number')
            .map((m) => m.commentsCount as number)
        ),
      },
      postsPerHour,
      competition,
      formats,
      related,
      topPosts: top.slice(0, 9).map(slim),
      recentPosts: recent.slice(0, 6).map(slim),
      fetchedAt: new Date().toISOString(),
    };
  }

  // ---- AI ideas --------------------------------------------------------
  async suggest(org: Organization, topic: string) {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      AI_CREDIT_TYPE
    );
    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.AI,
      });
    }
    try {
      const ideas = await this._subscriptionService.useCredit(
        org,
        AI_CREDIT_TYPE,
        () => this._openai.generateInstagramHashtagIdeas(topic)
      );
      return {
        hashtags: ideas.hashtags
          .map((h) => ({ ...h, tag: normalizeHashtag(h.tag).replace(/[^\p{L}\p{N}_]/gu, '') }))
          .filter((h) => h.tag),
      };
    } catch (err) {
      throw generationError(err);
    }
  }

  // ---- saved sets ------------------------------------------------------
  async sets(org: Organization) {
    const rows = await this._repo.listSets(org.id);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      hashtags: (r.hashtags as any as string[]) || [],
      createdAt: r.createdAt,
    }));
  }

  async saveSet(org: Organization, name: string, hashtags: string[]) {
    if ((await this._repo.countSets(org.id)) >= MAX_SETS_PER_ORG) {
      throw new HttpException(
        `You can keep up to ${MAX_SETS_PER_ORG} saved hashtag sets.`,
        400
      );
    }
    const clean = [
      ...new Set(
        hashtags
          .map((h) => normalizeHashtag(h))
          .filter((h) => /^[\p{L}\p{N}_]{1,100}$/u.test(h))
      ),
    ];
    if (!clean.length) {
      throw new HttpException('Add at least one valid hashtag.', 400);
    }
    const row = await this._repo.createSet(org.id, name.trim(), clean);
    return { id: row.id };
  }

  async deleteSet(org: Organization, id: string) {
    if (!(await this._repo.deleteSet(org.id, id))) {
      throw new HttpException('Set not found', 404);
    }
    return { success: true };
  }
}
