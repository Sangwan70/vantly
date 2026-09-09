import { Injectable } from '@nestjs/common';
import { PricingPlan } from '@prisma/client';
import {
  pricing as DEFAULT_PRICING,
  PricingInterface,
  PricingInnerInterface,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { PricingPlansRepository } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.repository';
import { PricingPlanDto } from '@gitroom/nestjs-libraries/dtos/billing/pricing-plan.dto';

export { PricingInterface, PricingInnerInterface };

// Fixed, known set of tiers - FREE plus every SubscriptionTier enum value.
// No create/delete from the admin UI: adding a real new tier would also
// require a Prisma enum change and touching every one of the call sites
// below by hand, which is out of scope for a pricing/copy edit.
export const PRICING_PLAN_TIERS = [
  'FREE',
  'STANDARD',
  'TEAM',
  'PRO',
  'ULTIMATE',
] as const;
export type PricingPlanTier = (typeof PRICING_PLAN_TIERS)[number];

const DEFAULT_DISPLAY_NAMES: Record<PricingPlanTier, string> = {
  FREE: 'Free',
  STANDARD: 'Standard',
  TEAM: 'Team',
  PRO: 'Pro',
  ULTIMATE: 'Ultimate',
};

// Marketing bullet copy migrating in from the old hand-maintained
// apps/frontend/src/components/marketing/pricing-tiers.ts MARKETING_TIERS
// constant (now deleted - see pricing-cards.component.tsx), used only to
// seed this table's `features` column with real existing copy on first
// read so the public pricing page shows the same bullets it always did,
// not a blank list. FREE never appeared in the marketing card grid, so it
// never had bullet copy to preserve.
const DEFAULT_FEATURES: Record<PricingPlanTier, string[]> = {
  FREE: [],
  STANDARD: [
    '5 connected channels',
    'Unlimited scheduled posts',
    '20 AI image generations / month',
    '3 AI video generations / month',
    '50 YouTube Optimizer AI suggestions / month',
    'Import posts from connected channels',
    'Public API access + 2 webhooks',
  ],
  TEAM: [
    'Everything in Standard, plus:',
    '10 connected channels',
    'Team members & shared workspace',
    'Auto-posting',
    'Community engagement features',
    '100 AI image generations / month',
    '10 AI video generations / month',
    '150 YouTube Optimizer AI suggestions / month',
    '10 webhooks',
  ],
  PRO: [
    'Everything in Team, plus:',
    '30 connected channels',
    '300 AI image generations / month',
    '30 AI video generations / month',
    '300 YouTube Optimizer AI suggestions / month',
    '30 webhooks',
  ],
  ULTIMATE: [
    'Everything in Pro, plus:',
    '100 connected channels',
    '500 AI image generations / month',
    '60 AI video generations / month',
    '600 YouTube Optimizer AI suggestions / month',
    '10,000 webhooks',
  ],
};

function seedDataFor(tier: PricingPlanTier): PricingPlanDto {
  const source = DEFAULT_PRICING[tier];
  return {
    displayName: DEFAULT_DISPLAY_NAMES[tier],
    features: DEFAULT_FEATURES[tier],
    monthPrice: source.month_price,
    yearPrice: source.year_price,
    channel: source.channel ?? 0,
    postsPerMonth: source.posts_per_month,
    teamMembers: source.team_members,
    communityFeatures: source.community_features,
    featuredByGitroom: source.featured_by_gitroom,
    ai: source.ai,
    importFromChannels: source.import_from_channels,
    imageGenerator: source.image_generator ?? false,
    imageGenerationCount: source.image_generation_count,
    generateVideos: source.generate_videos,
    youtubeTextSuggestions: source.youtube_text_suggestions,
    publicApi: source.public_api,
    webhooks: source.webhooks,
    autoPost: source.autoPost,
    sortOrder: PRICING_PLAN_TIERS.indexOf(tier) - 1,
  };
}

function toInner(row: PricingPlan): PricingInnerInterface {
  return {
    current: row.tier,
    month_price: row.monthPrice,
    year_price: row.yearPrice,
    channel: row.channel,
    posts_per_month: row.postsPerMonth,
    team_members: row.teamMembers,
    community_features: row.communityFeatures,
    featured_by_gitroom: row.featuredByGitroom,
    ai: row.ai,
    import_from_channels: row.importFromChannels,
    image_generator: row.imageGenerator,
    image_generation_count: row.imageGenerationCount,
    generate_videos: row.generateVideos,
    youtube_text_suggestions: row.youtubeTextSuggestions,
    public_api: row.publicApi,
    webhooks: row.webhooks,
    autoPost: row.autoPost,
  };
}

@Injectable()
export class PricingPlansService {
  constructor(private _pricingPlansRepository: PricingPlansRepository) {}

  private async ensureDefaultSeeded(tier: PricingPlanTier) {
    const existing = await this._pricingPlansRepository.getByTier(tier);
    if (existing) return existing;
    return this._pricingPlansRepository.upsert(
      tier,
      seedDataFor(tier),
      'system:default-seed'
    );
  }

  /**
   * Live, DB-backed replacement for the old static `pricing` import from
   * subscriptions/pricing.ts. Returns the exact same shape
   * (Record<tier, PricingInnerInterface>, snake_case fields) so every
   * converted call site only needed one new line added,
   * `const pricing = await this._pricingPlansService.getPricingMap();`,
   * with every downstream `pricing[tier].field` reference left completely
   * unchanged. Converted call sites: permissions.service.ts,
   * organization.service.ts, subscription.service.ts, stripe.service.ts,
   * razorpay.service.ts, integrations.controller.ts, public.controller.ts,
   * users.controller.ts (backend, all already-async methods) plus
   * user.context.tsx, impersonate.tsx, main.billing.component.tsx,
   * lifetime.deal.tsx, first.billing.component.tsx (frontend, via the
   * public GET /public/pricing-plans endpoint and the usePricingPlans()
   * SWR hook instead of an async service call).
   *
   * Issues exactly one query (listAll) in the steady state - the
   * per-tier seed check only runs the rare time a tier row is actually
   * missing, since this can be called on nearly every authenticated
   * request (e.g. every permission check) and a constant 5-extra-query
   * seed check on every call would be a real cost in production.
   */
  async getPricingMap(): Promise<PricingInterface> {
    const rows = await this._pricingPlansRepository.listAll();
    const byTier = new Map(rows.map((row) => [row.tier, row]));
    const missing = PRICING_PLAN_TIERS.filter((tier) => !byTier.has(tier));
    if (missing.length) {
      await Promise.all(missing.map((tier) => this.ensureDefaultSeeded(tier)));
      const refreshed = await this._pricingPlansRepository.listAll();
      return Object.fromEntries(refreshed.map((row) => [row.tier, toInner(row)]));
    }
    return Object.fromEntries(rows.map((row) => [row.tier, toInner(row)]));
  }

  // Admin list (Admin Panel -> Plans & Pricing) - full row including
  // marketing/admin-only fields (badge, description, gateway ids) and
  // inactive/unpurchasable rows, ordered by sortOrder. `customized`
  // mirrors StaticPage's convention: true only once a real admin save has
  // happened (updatedBy isn't the seed sentinel) - every tier always has a
  // row here (unlike StaticPage's optional per-slug override), so unlike
  // StaticPage this can't use row-existence as the signal.
  async listAllForAdmin() {
    await Promise.all(PRICING_PLAN_TIERS.map((tier) => this.ensureDefaultSeeded(tier)));
    const rows = await this._pricingPlansRepository.listAll();
    return rows.map((row) => ({
      ...row,
      customized: row.updatedBy !== 'system:default-seed',
    }));
  }

  async getByTier(tier: string) {
    if ((PRICING_PLAN_TIERS as readonly string[]).includes(tier)) {
      await this.ensureDefaultSeeded(tier as PricingPlanTier);
    }
    return this._pricingPlansRepository.getByTier(tier);
  }

  upsert(tier: PricingPlanTier, body: PricingPlanDto, updatedBy: string) {
    return this._pricingPlansRepository.upsert(tier, body, updatedBy);
  }

  // "Reset to default" - re-seeds the tier's row back to the original
  // hardcoded pricing.ts values and marketing copy (see
  // pricing-plans.repository.ts's reseedDefault doc comment for why this
  // re-seeds rather than deletes the row).
  revertToDefault(tier: PricingPlanTier) {
    return this._pricingPlansRepository.reseedDefault(tier, seedDataFor(tier));
  }

  // DB-first, env-fallback RazorPay Plan id resolution - mirrors
  // PaymentGatewaySettingsService's DB-first/env-fallback credential
  // pattern. See schema.prisma's PricingPlan.razorpayPlanIdMonthly doc
  // comment: RazorPay Plans are immutable once created, so this is the
  // only way an admin price edit can actually reach a RazorPay charge -
  // by pointing this at a freshly-created Plan id, not by editing an
  // existing one.
  async resolveRazorpayPlanId(
    tier: string,
    period: 'MONTHLY' | 'YEARLY'
  ): Promise<string | undefined> {
    const row = await this.getByTier(tier);
    const dbValue =
      period === 'MONTHLY'
        ? row?.razorpayPlanIdMonthly
        : row?.razorpayPlanIdYearly;
    if (dbValue) return dbValue;
    const envKey = `RAZORPAY_${tier}_PLAN_${period}`;
    return process.env[envKey] || undefined;
  }

  // Writes a freshly-created RazorPay Plan id back into this tier's row -
  // used only by RazorpayService.syncPlanId() (Admin Panel -> Plans &
  // Pricing -> "Sync to RazorPay"). Re-sends the full row as the upsert
  // body (not a partial patch) to match the same full-replace convention
  // PricingPlansController.updatePricingPlan uses for a regular admin
  // save, since PricingPlansRepository.upsert's `create` branch spreads
  // whatever body it's given.
  async setRazorpayPlanId(
    tier: PricingPlanTier,
    period: 'MONTHLY' | 'YEARLY',
    planId: string,
    updatedBy: string
  ): Promise<PricingPlan> {
    const row = await this.ensureDefaultSeeded(tier);
    const body: PricingPlanDto = {
      displayName: row.displayName,
      description: row.description ?? undefined,
      badge: row.badge ?? undefined,
      features: (row.features as string[]) ?? [],
      monthPrice: row.monthPrice,
      yearPrice: row.yearPrice,
      channel: row.channel,
      postsPerMonth: row.postsPerMonth,
      teamMembers: row.teamMembers,
      communityFeatures: row.communityFeatures,
      featuredByGitroom: row.featuredByGitroom,
      ai: row.ai,
      importFromChannels: row.importFromChannels,
      imageGenerator: row.imageGenerator,
      imageGenerationCount: row.imageGenerationCount,
      generateVideos: row.generateVideos,
      youtubeTextSuggestions: row.youtubeTextSuggestions,
      publicApi: row.publicApi,
      webhooks: row.webhooks,
      autoPost: row.autoPost,
      razorpayPlanIdMonthly:
        period === 'MONTHLY' ? planId : row.razorpayPlanIdMonthly ?? undefined,
      razorpayPlanIdYearly:
        period === 'YEARLY' ? planId : row.razorpayPlanIdYearly ?? undefined,
      isActive: row.isActive,
      isPurchasable: row.isPurchasable,
      sortOrder: row.sortOrder,
    };
    return this._pricingPlansRepository.upsert(tier, body, updatedBy);
  }
}
