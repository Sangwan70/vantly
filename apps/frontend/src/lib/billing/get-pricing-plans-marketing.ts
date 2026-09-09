// Server-side data fetch for the public /pricing marketing cards, mirroring
// apps/frontend/src/components/legal/get-static-page.ts's BACKEND_INTERNAL_URL
// + cache:'no-store' pattern (no auth cookies needed, so this calls the
// backend directly rather than through internalFetch). Replaces the old
// hand-maintained apps/frontend/src/components/marketing/pricing-tiers.ts
// MARKETING_TIERS mirror, which had to be updated by hand every time the
// real tier prices/features changed - this always reflects whatever an
// admin has saved in Admin Panel -> Plans & Pricing. Returns [] on any
// failure so the pricing page still renders (just without plan cards)
// rather than crashing.

export interface MarketingPricingPlan {
  tier: string;
  displayName: string;
  description: string | null;
  badge: string | null;
  features: string[];
  monthPrice: number;
  yearPrice: number;
  channel: number;
  teamMembers: boolean;
  communityFeatures: boolean;
  autoPost: boolean;
  imageGenerationCount: number;
  generateVideos: number;
  youtubeTextSuggestions: number;
  webhooks: number;
  publicApi: boolean;
}

export async function getMarketingPricingPlans(): Promise<
  MarketingPricingPlan[]
> {
  try {
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/public/pricing-plans/marketing`,
      { cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data as MarketingPricingPlan[];
  } catch {
    return [];
  }
}
