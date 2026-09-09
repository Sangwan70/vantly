import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { PricingPlanDto } from '@gitroom/nestjs-libraries/dtos/billing/pricing-plan.dto';

@Injectable()
export class PricingPlansRepository {
  constructor(private _pricingPlan: PrismaRepository<'pricingPlan'>) {}

  getByTier(tier: string) {
    return this._pricingPlan.model.pricingPlan.findUnique({ where: { tier } });
  }

  // Ordered so the admin list and any future public rendering agree on
  // display order without each caller re-sorting.
  listAll() {
    return this._pricingPlan.model.pricingPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  upsert(tier: string, data: PricingPlanDto, updatedBy: string) {
    return this._pricingPlan.model.pricingPlan.upsert({
      where: { tier },
      create: { tier, ...(data as any), updatedBy },
      update: { ...data, updatedBy },
    });
  }

  // "Revert to default" - re-seeds the row with the original hardcoded
  // pricing.ts values instead of deleting it (unlike StaticPage, this
  // table's rows are always meant to exist - a missing row isn't a valid
  // "no override" state anywhere downstream, since every synchronous call
  // site that used to read subscriptions/pricing.ts directly now reads
  // this table and expects all 5 tiers to be present).
  reseedDefault(tier: string, data: PricingPlanDto) {
    return this._pricingPlan.model.pricingPlan.upsert({
      where: { tier },
      create: { tier, ...(data as any), updatedBy: 'system:default-seed' },
      update: { ...data, updatedBy: 'system:default-seed' },
    });
  }
}
