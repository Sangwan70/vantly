import { Body, Controller, Get, HttpException, Param, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import {
  PricingPlansService,
  PRICING_PLAN_TIERS,
  PricingPlanTier,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.service';
import { PricingPlanDto } from '@gitroom/nestjs-libraries/dtos/billing/pricing-plan.dto';

// Admin-only Plans & Pricing management - the DB-backed replacement for
// what used to be the hardcoded subscriptions/pricing.ts object. Mirrors
// ContentController's shape (assertSuperAdmin guard, list/update/revert)
// for a fixed, known set of rows rather than a free-form CRUD resource -
// see PricingPlansService's own doc comment for why tiers can never be
// added or deleted here.
@ApiTags('PricingPlans')
@Controller('/admin/pricing-plans')
export class PricingPlansController {
  constructor(private _pricingPlansService: PricingPlansService) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  private assertKnownTier(tier: string): asserts tier is PricingPlanTier {
    if (!(PRICING_PLAN_TIERS as readonly string[]).includes(tier)) {
      throw new HttpException('Unknown pricing tier', 400);
    }
  }

  @Get('/')
  async listPricingPlans(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._pricingPlansService.listAllForAdmin();
  }

  @Put('/:tier')
  async updatePricingPlan(
    @GetUserFromRequest() user: User,
    @Param('tier') tier: string,
    @Body() body: PricingPlanDto
  ) {
    this.assertSuperAdmin(user);
    this.assertKnownTier(tier);
    return this._pricingPlansService.upsert(tier, body, user.id);
  }

  // "Reset to default" - re-seeds this tier's row back to the original
  // hardcoded price/features/limits (see PricingPlansService.
  // revertToDefault's doc comment for why this re-seeds rather than
  // deletes, unlike StaticPage's revert).
  @Post('/:tier/revert')
  async revertPricingPlan(
    @GetUserFromRequest() user: User,
    @Param('tier') tier: string
  ) {
    this.assertSuperAdmin(user);
    this.assertKnownTier(tier);
    await this._pricingPlansService.revertToDefault(tier);
    return { reverted: true };
  }
}
