import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

@Injectable()
export class PromoteHashtagRepository {
  constructor(
    private _lookup: PrismaRepository<'promoteHashtagLookup'>,
    private _set: PrismaRepository<'promoteHashtagSet'>
  ) {}

  getLookup(integrationId: string, hashtag: string) {
    return this._lookup.model.promoteHashtagLookup.findUnique({
      where: { integrationId_hashtag: { integrationId, hashtag } },
    });
  }

  // Lookups still inside their Meta 7-day window, oldest first.
  windowLookups(integrationId: string, since: Date) {
    return this._lookup.model.promoteHashtagLookup.findMany({
      where: { integrationId, windowStart: { gte: since } },
      orderBy: { windowStart: 'asc' },
      select: { hashtag: true, windowStart: true },
    });
  }

  history(integrationId: string) {
    return this._lookup.model.promoteHashtagLookup.findMany({
      where: { integrationId },
      orderBy: { fetchedAt: 'desc' },
      take: 50,
      select: { hashtag: true, fetchedAt: true, windowStart: true, result: true },
    });
  }

  saveLookup(
    integrationId: string,
    hashtag: string,
    data: { igHashtagId: string; result: any; windowStart: Date }
  ) {
    const fetchedAt = new Date();
    return this._lookup.model.promoteHashtagLookup.upsert({
      where: { integrationId_hashtag: { integrationId, hashtag } },
      create: { integrationId, hashtag, ...data, fetchedAt },
      update: { ...data, fetchedAt },
    });
  }

  listSets(orgId: string) {
    return this._set.model.promoteHashtagSet.findMany({
      where: { organizationId: orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  countSets(orgId: string) {
    return this._set.model.promoteHashtagSet.count({
      where: { organizationId: orgId, deletedAt: null },
    });
  }

  createSet(orgId: string, name: string, hashtags: string[]) {
    return this._set.model.promoteHashtagSet.create({
      data: { organizationId: orgId, name, hashtags },
    });
  }

  async deleteSet(orgId: string, id: string) {
    const res = await this._set.model.promoteHashtagSet.updateMany({
      where: { id, organizationId: orgId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return res.count > 0;
  }
}
