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
import {
  RazorpayService,
  RazorpayTier,
} from '@gitroom/nestjs-libraries/services/razorpay.service';

// Admin-only Plans & Pricing management - the DB-backed replacement for
// what used to be the hardcoded subscriptions/pricing.ts object. Mirrors
// ContentController's shape (assertSuperAdmin guard, list/update/revert)
// for a fixed, known set of rows rather than a free-form CRUD resource -
// see PricingPlansService's own doc comment for why tiers can never be
// added or deleted here.
@ApiTags('PricingPlans')
@Controller('/admin/pricing-plans')
export class PricingPlansController {
  constructor(
    private _pricingPlansService: PricingPlansService,
    private _razorpayService: RazorpayService
  ) {}

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

  private assertRazorpayTier(tier: string): asserts tier is RazorpayTier {
    this.assertKnownTier(tier);
    if (tier === 'FREE') {
      throw new HttpException(
        'FREE has no checkout - there is nothing to sync to RazorPay',
        400
      );
    }
  }

  // "Sync to RazorPay" (one tier) - auto-creates whichever of the
  // monthly/yearly RazorPay Plans this tier is missing and saves the new
  // id(s) into its row, the self-serve alternative to manually creating a
  // Plan in RazorPay's Dashboard and pasting the id in below (see
  // RazorpayService.syncPlanId's doc comment for why this only ever fills
  // in a missing id, never replaces an existing one).
  @Post('/:tier/sync-razorpay')
  async syncRazorpayPlan(
    @GetUserFromRequest() user: User,
    @Param('tier') tier: string
  ) {
    this.assertSuperAdmin(user);
    this.assertRazorpayTier(tier);

    // syncPlanId throws a plain Error (not HttpException) for expected,
    // admin-actionable failures (no credentials, no price set) - caught
    // and re-thrown here as a proper 400 so its message actually reaches
    // the admin UI instead of being masked by Nest's default 500 handler.
    try {
      const [monthly, yearly] = await Promise.all([
        this._razorpayService.syncPlanId(tier, 'MONTHLY', user.id),
        this._razorpayService.syncPlanId(tier, 'YEARLY', user.id),
      ]);

      return {
        razorpayPlanIdMonthly: monthly.planId,
        razorpayPlanIdYearly: yearly.planId,
        createdMonthly: monthly.created,
        createdYearly: yearly.created,
      };
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Failed to sync with RazorPay',
        400
      );
    }
  }

  // "Sync all plans" - runs the same per-tier sync across every
  // purchasable tier. Each tier is resolved independently (Promise.allSettled)
  // so one tier failing (e.g. a $0 price, or a tier that already errored)
  // doesn't stop the others from syncing - the response lists exactly
  // which tiers succeeded and which need attention.
  @Post('/sync-razorpay')
  async syncAllRazorpayPlans(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    const tiers = PRICING_PLAN_TIERS.filter(
      (tier) => tier !== 'FREE'
    ) as RazorpayTier[];

    const results = await Promise.allSettled(
      tiers.map(async (tier) => {
        const [monthly, yearly] = await Promise.all([
          this._razorpayService.syncPlanId(tier, 'MONTHLY', user.id),
          this._razorpayService.syncPlanId(tier, 'YEARLY', user.id),
        ]);
        return { tier, monthly, yearly };
      })
    );

    return results.map((result, index) => {
      const tier = tiers[index];
      if (result.status === 'fulfilled') {
        return {
          tier,
          ok: true as const,
          razorpayPlanIdMonthly: result.value.monthly.planId,
          razorpayPlanIdYearly: result.value.yearly.planId,
        };
      }
      return {
        tier,
        ok: false as const,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Failed to sync this tier',
      };
    });
  }
}
