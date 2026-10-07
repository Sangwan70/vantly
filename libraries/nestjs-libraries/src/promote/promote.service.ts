import { HttpException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { TemporalService } from 'nestjs-temporal-core';
import { TypedSearchAttributes } from '@temporalio/common';
import { organizationId as organizationIdAttr } from '@gitroom/nestjs-libraries/temporal/temporal.search.attribute';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PromoteRepository } from '@gitroom/nestjs-libraries/database/prisma/promote/promote.repository';
import {
  PromoteMedia,
  PromoteProfile,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';

// Promote only works through the official Graph API Business Discovery
// endpoint, which Meta exposes for Facebook-Login Instagram connections.
export const PROMOTE_PROVIDER = 'instagram';
export const MAX_COMPETITORS_PER_ACCOUNT = 10;
const SELF_CACHE_SECONDS = 60 * 60;

const engagement = (media: PromoteMedia[]) => {
  const withLikes = media.filter((m) => typeof m.likeCount === 'number');
  const withComments = media.filter((m) => typeof m.commentsCount === 'number');
  const avg = (arr: number[]) =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const monthAgo = Date.now() - 30 * 86400000;
  return {
    avgLikes: avg(withLikes.map((m) => m.likeCount as number)),
    avgComments: avg(withComments.map((m) => m.commentsCount as number)),
    postsLast30d: media.filter(
      (m) => m.timestamp && new Date(m.timestamp).getTime() >= monthAgo
    ).length,
  };
};

@Injectable()
export class PromoteService {
  constructor(
    private _promoteRepository: PromoteRepository,
    private _integrationService: IntegrationService,
    private _temporalService: TemporalService
  ) {}

  // ---- accounts --------------------------------------------------------
  // Every Instagram account the org has connected, flagged by whether the
  // Promote tools can use it. Standalone (Instagram Login) accounts are
  // listed with a reason so the UI can tell the user how to unlock them.
  async accounts(org: Organization) {
    const list = await this._integrationService.getIntegrationsList(org.id);
    return list
      .filter((i) => i.providerIdentifier.startsWith('instagram'))
      .map((i) => {
        const usable =
          i.providerIdentifier === PROMOTE_PROVIDER &&
          !i.disabled &&
          !i.refreshNeeded &&
          !i.inBetweenSteps;
        let reason: string | null = null;
        if (i.providerIdentifier !== PROMOTE_PROVIDER) {
          reason =
            'Reconnect this account as "Instagram (Facebook Business)" to unlock Promote tools.';
        } else if (i.refreshNeeded) {
          reason = 'This account needs to be reconnected.';
        } else if (i.disabled) {
          reason = 'This channel is disabled.';
        } else if (i.inBetweenSteps) {
          reason = 'Finish connecting this account first.';
        }
        return {
          id: i.id,
          name: i.name,
          picture: i.picture,
          providerIdentifier: i.providerIdentifier,
          eligible: usable,
          reason,
        };
      });
  }

  private async requireAccount(org: Organization, integrationId: string) {
    const found = await this._integrationService.getValidIntegrationAndProvider(
      org,
      integrationId
    );
    if (
      !found ||
      found.integration.providerIdentifier !== PROMOTE_PROVIDER ||
      !found.provider.businessDiscovery
    ) {
      throw new HttpException(
        'Promote tools need an Instagram account connected as "Instagram (Facebook Business)".',
        400
      );
    }
    return found as {
      integration: typeof found.integration;
      provider: typeof found.provider & {
        businessDiscovery: NonNullable<typeof found.provider.businessDiscovery>;
        ownProfile: NonNullable<typeof found.provider.ownProfile>;
      };
    };
  }

  private toHttp(e: any): never {
    const msg = String(e?.message || 'Instagram request failed');
    if (e instanceof HttpException) {
      throw e;
    }
    if (msg === 'TOKEN_INVALID') {
      throw new HttpException(
        'Instagram rejected the saved login. Reconnect the account and try again.',
        400
      );
    }
    if (msg === 'RATE_LIMITED') {
      throw new HttpException(
        'Instagram is rate limiting this account. Try again in a little while.',
        429
      );
    }
    if (msg.startsWith('NOT_FOUND')) {
      throw new HttpException(
        msg.replace(/^NOT_FOUND:\s*/, '') ||
          'Account not found, or it is not a Business/Creator account.',
        404
      );
    }
    throw new HttpException(msg, 502);
  }

  // ---- competitors -----------------------------------------------------
  async addCompetitor(org: Organization, integrationId: string, raw: string) {
    const username = raw.replace(/^@/, '').trim().toLowerCase();
    const { integration, provider } = await this.requireAccount(
      org,
      integrationId
    );

    if (integration.profile && integration.profile.toLowerCase() === username) {
      throw new HttpException(
        'That is your own account. Add a competitor instead.',
        400
      );
    }

    const existing = await this._promoteRepository.findByUsername(
      integration.id,
      username
    );
    if (existing && !existing.deletedAt) {
      throw new HttpException('You are already tracking this account.', 400);
    }

    const count = await this._promoteRepository.countCompetitors(
      org.id,
      integration.id
    );
    if (count >= MAX_COMPETITORS_PER_ACCOUNT) {
      throw new HttpException(
        `You can track up to ${MAX_COMPETITORS_PER_ACCOUNT} competitors per account.`,
        400
      );
    }

    let profile: PromoteProfile;
    try {
      profile = await provider.businessDiscovery(
        integration.token,
        integration.internalId,
        username
      );
    } catch (e) {
      this.toHttp(e);
    }

    const row = await this._promoteRepository.upsertCompetitor(
      org.id,
      integration.id,
      profile
    );
    await this._promoteRepository.saveSnapshot(row.id, {
      followersCount: profile.followersCount,
      followsCount: profile.followsCount,
      mediaCount: profile.mediaCount,
      ...engagement(profile.media),
    });

    await this.startDailySync(org.id, row.id);
    return { id: row.id };
  }

  async removeCompetitor(org: Organization, integrationId: string, id: string) {
    const ok = await this._promoteRepository.softDelete(
      org.id,
      integrationId,
      id
    );
    if (!ok) {
      throw new HttpException('Competitor not found', 404);
    }
    // The sync workflow notices the soft delete on its next tick and ends.
    return { success: true };
  }

  async refreshCompetitor(org: Organization, integrationId: string, id: string) {
    const { integration, provider } = await this.requireAccount(
      org,
      integrationId
    );
    const competitor = await this._promoteRepository.getCompetitor(
      org.id,
      integration.id,
      id
    );
    if (!competitor) {
      throw new HttpException('Competitor not found', 404);
    }
    try {
      await this.syncOne(
        competitor.id,
        competitor.username,
        integration.token,
        integration.internalId,
        provider
      );
    } catch (e) {
      this.toHttp(e);
    }
    return { success: true };
  }

  async overview(org: Organization, integrationId: string) {
    const { integration, provider } = await this.requireAccount(
      org,
      integrationId
    );

    const competitors = await this._promoteRepository.listCompetitors(
      org.id,
      integration.id
    );
    const snapshots = await this._promoteRepository.listSnapshots(
      competitors.map((c) => c.id)
    );

    const self = await this.loadSelf(integration.id, () =>
      provider.ownProfile(integration.token, integration.internalId)
    );

    return {
      limit: MAX_COMPETITORS_PER_ACCOUNT,
      self,
      competitors: competitors.map((c) => {
        const media = ((c.recentMedia as any) || []) as PromoteMedia[];
        const series = snapshots
          .filter((s: any) => s.competitorId === c.id)
          .map((s: any) => ({
            date: s.date,
            followers: s.followersCount,
          }));
        return {
          id: c.id,
          username: c.username,
          name: c.name,
          picture: c.profilePictureUrl,
          biography: c.biography,
          followers: c.followersCount,
          follows: c.followsCount,
          mediaCount: c.mediaCount,
          ...this.metrics(c.followersCount, media),
          growth: this.growth(series),
          series,
          topPosts: this.topPosts(media),
          lastSyncedAt: c.lastSyncedAt,
          lastError: c.lastError,
        };
      }),
    };
  }

  // ---- sync (used by refresh button and the daily Temporal activity) ----
  // Returns false when the competitor (or its account) is gone, which ends
  // the daily workflow; true otherwise, even after a failed fetch, so a
  // transient Instagram outage doesn't permanently stop tracking.
  async syncCompetitorById(id: string): Promise<boolean> {
    const competitor = await this._promoteRepository.getCompetitorForSync(id);
    if (!competitor) {
      return false;
    }
    try {
      const found = await this._integrationService.getValidIntegrationAndProvider(
        { id: competitor.organizationId } as Organization,
        competitor.integrationId
      );
      if (!found || !found.provider.businessDiscovery) {
        await this._promoteRepository.setError(
          id,
          'Connected Instagram account is unavailable. Reconnect it to resume tracking.'
        );
        return true;
      }
      await this.syncOne(
        competitor.id,
        competitor.username,
        found.integration.token,
        found.integration.internalId,
        found.provider as any
      );
    } catch (e: any) {
      await this._promoteRepository.setError(
        id,
        String(e?.message || 'Sync failed')
      );
    }
    return true;
  }

  private async syncOne(
    id: string,
    username: string,
    token: string,
    internalId: string,
    provider: { businessDiscovery: (t: string, i: string, u: string) => Promise<PromoteProfile> }
  ) {
    try {
      const profile = await provider.businessDiscovery(token, internalId, username);
      await this._promoteRepository.applySync(id, profile);
      await this._promoteRepository.saveSnapshot(id, {
        followersCount: profile.followersCount,
        followsCount: profile.followsCount,
        mediaCount: profile.mediaCount,
        ...engagement(profile.media),
      });
    } catch (e: any) {
      await this._promoteRepository.setError(id, String(e?.message || 'Sync failed'));
      throw e;
    }
  }

  private async startDailySync(orgId: string, competitorId: string) {
    try {
      await this._temporalService.client
        .getRawClient()
        ?.workflow.start('promoteSyncWorkflow', {
          args: [{ competitorId }],
          workflowId: `promote_sync_${competitorId}`,
          taskQueue: 'main',
          workflowIdConflictPolicy: 'USE_EXISTING',
          typedSearchAttributes: new TypedSearchAttributes([
            { key: organizationIdAttr, value: orgId },
          ]),
        });
    } catch (err) {
      // Tracking still works manually via Refresh if Temporal is unavailable.
    }
  }

  // ---- helpers ---------------------------------------------------------
  private async loadSelf(
    integrationId: string,
    load: () => Promise<PromoteProfile>
  ) {
    const key = `promote:self:${integrationId}`;
    let profile: PromoteProfile | undefined;
    try {
      const cached = await ioRedis.get(key);
      if (cached) {
        profile = JSON.parse(cached);
      }
    } catch (e) {}

    if (!profile) {
      try {
        profile = await load();
        await ioRedis.set(key, JSON.stringify(profile), 'EX', SELF_CACHE_SECONDS);
      } catch (e) {
        return null;
      }
    }

    return {
      username: profile.username,
      name: profile.name,
      picture: profile.profilePictureUrl,
      followers: profile.followersCount ?? null,
      follows: profile.followsCount ?? null,
      mediaCount: profile.mediaCount ?? null,
      ...this.metrics(profile.followersCount ?? null, profile.media || []),
      topPosts: this.topPosts(profile.media || []),
    };
  }

  private metrics(followers: number | null, media: PromoteMedia[]) {
    const e = engagement(media);
    const interactions = (e.avgLikes ?? 0) + (e.avgComments ?? 0);
    return {
      avgLikes: e.avgLikes,
      avgComments: e.avgComments,
      postsLast30d: e.postsLast30d,
      engagementRate:
        followers && (e.avgLikes !== null || e.avgComments !== null)
          ? (interactions / followers) * 100
          : null,
    };
  }

  private topPosts(media: PromoteMedia[]) {
    return [...media]
      .sort(
        (a, b) =>
          (b.likeCount ?? 0) +
          (b.commentsCount ?? 0) -
          ((a.likeCount ?? 0) + (a.commentsCount ?? 0))
      )
      .slice(0, 3);
  }

  // Follower change across the available snapshot window (up to 30 days).
  private growth(series: { date: Date; followers: number | null }[]) {
    const pts = series.filter((p) => typeof p.followers === 'number');
    if (pts.length < 2) {
      return null;
    }
    const cutoff = Date.now() - 30 * 86400000;
    const inWindow = pts.filter((p) => new Date(p.date).getTime() >= cutoff);
    const first = inWindow[0] || pts[0];
    const last = pts[pts.length - 1];
    const days = Math.round(
      (new Date(last.date).getTime() - new Date(first.date).getTime()) /
        86400000
    );
    if (days < 1) {
      return null;
    }
    return {
      delta: (last.followers as number) - (first.followers as number),
      days,
    };
  }
}
