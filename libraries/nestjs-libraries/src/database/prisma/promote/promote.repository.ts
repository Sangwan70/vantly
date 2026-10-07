import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { PromoteProfile } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';

const startOfUtcDay = (d = new Date()) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

@Injectable()
export class PromoteRepository {
  constructor(
    private _competitor: PrismaRepository<'promoteCompetitor'>,
    private _snapshot: PrismaRepository<'promoteCompetitorSnapshot'>
  ) {}

  listCompetitors(orgId: string, integrationId: string) {
    return this._competitor.model.promoteCompetitor.findMany({
      where: { organizationId: orgId, integrationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
  }

  countCompetitors(orgId: string, integrationId: string) {
    return this._competitor.model.promoteCompetitor.count({
      where: { organizationId: orgId, integrationId, deletedAt: null },
    });
  }

  getCompetitor(orgId: string, integrationId: string, id: string) {
    return this._competitor.model.promoteCompetitor.findFirst({
      where: { id, organizationId: orgId, integrationId, deletedAt: null },
    });
  }

  // Used by the sync workflow, which only knows the competitor id.
  getCompetitorForSync(id: string) {
    return this._competitor.model.promoteCompetitor.findFirst({
      where: { id, deletedAt: null, integration: { deletedAt: null } },
      include: {
        integration: {
          select: { id: true, organizationId: true, deletedAt: true },
        },
      },
    });
  }

  findByUsername(integrationId: string, username: string) {
    return this._competitor.model.promoteCompetitor.findUnique({
      where: { integrationId_username: { integrationId, username } },
    });
  }

  // Re-adding a previously removed competitor revives the same row (keeps
  // the unique [integrationId, username] constraint happy).
  async upsertCompetitor(
    orgId: string,
    integrationId: string,
    profile: PromoteProfile
  ) {
    const data = this.profileData(profile);
    return this._competitor.model.promoteCompetitor.upsert({
      where: {
        integrationId_username: {
          integrationId,
          username: profile.username.toLowerCase(),
        },
      },
      create: {
        organizationId: orgId,
        integrationId,
        username: profile.username.toLowerCase(),
        ...data,
        lastSyncedAt: new Date(),
      },
      update: { ...data, deletedAt: null, lastSyncedAt: new Date(), lastError: null },
    });
  }

  async applySync(id: string, profile: PromoteProfile) {
    return this._competitor.model.promoteCompetitor.update({
      where: { id },
      data: { ...this.profileData(profile), lastSyncedAt: new Date(), lastError: null },
    });
  }

  setError(id: string, message: string) {
    return this._competitor.model.promoteCompetitor.update({
      where: { id },
      data: { lastError: message.slice(0, 500) },
    });
  }

  async softDelete(orgId: string, integrationId: string, id: string) {
    const res = await this._competitor.model.promoteCompetitor.updateMany({
      where: { id, organizationId: orgId, integrationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count > 0;
  }

  // One snapshot per UTC day; a second sync the same day overwrites it.
  saveSnapshot(
    competitorId: string,
    stats: {
      followersCount?: number;
      followsCount?: number;
      mediaCount?: number;
      avgLikes?: number | null;
      avgComments?: number | null;
      postsLast30d?: number | null;
    }
  ) {
    const date = startOfUtcDay();
    return this._snapshot.model.promoteCompetitorSnapshot.upsert({
      where: { competitorId_date: { competitorId, date } },
      create: { competitorId, date, ...stats },
      update: { ...stats },
    });
  }

  listSnapshots(competitorIds: string[], sinceDays = 90) {
    if (!competitorIds.length) {
      return Promise.resolve([] as any[]);
    }
    const since = startOfUtcDay(new Date(Date.now() - sinceDays * 86400000));
    return this._snapshot.model.promoteCompetitorSnapshot.findMany({
      where: { competitorId: { in: competitorIds }, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  private profileData(p: PromoteProfile) {
    return {
      igUserId: p.igUserId ?? null,
      name: p.name ?? null,
      profilePictureUrl: p.profilePictureUrl ?? null,
      biography: p.biography ?? null,
      followersCount: p.followersCount ?? null,
      followsCount: p.followsCount ?? null,
      mediaCount: p.mediaCount ?? null,
      recentMedia: (p.media || []) as any,
    };
  }
}
