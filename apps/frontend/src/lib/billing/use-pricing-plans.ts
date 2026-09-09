'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  pricing as DEFAULT_PRICING,
  PricingInterface,
} from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';

const PRICING_PLANS_KEY = '/public/pricing-plans';

/**
 * Live, DB-backed replacement for the old static `pricing` import from
 * subscriptions/pricing.ts, for authenticated (app) components. Its own
 * hook per CLAUDE.md's SWR rule - one useSWR call per hook. Returns the
 * exact same shape (Record<tier, PricingInnerInterface>, snake_case
 * fields) the static import always had, so every converted call site
 * only needed `const { data: pricing } = usePricingPlans();` added, with
 * every downstream `pricing[tier].field` reference left unchanged -
 * mirrors the same technique used on the backend, see
 * PricingPlansService.getPricingMap()'s doc comment for the full list of
 * converted call sites (user.context.tsx, impersonate.tsx,
 * main.billing.component.tsx, lifetime.deal.tsx,
 * first.billing.component.tsx here on the frontend).
 *
 * `fallbackData` is the original hardcoded defaults so every consumer
 * renders exactly as before on first paint, before this fetch resolves,
 * without needing its own loading branch just for pricing data - hits
 * the backend's public (no-auth) endpoint since pricing tiers aren't
 * sensitive and this must also work for a not-yet-subscribed user.
 */
export function usePricingPlans() {
  const fetch = useFetch();
  return useSWR<PricingInterface>(
    PRICING_PLANS_KEY,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load pricing plans');
      }
      return res.json();
    },
    {
      fallbackData: DEFAULT_PRICING,
      revalidateOnFocus: false,
    }
  );
}
