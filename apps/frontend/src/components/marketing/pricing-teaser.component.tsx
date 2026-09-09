'use client';

import Link from 'next/link';
import { MarketingPricingPlan } from '@gitroom/frontend/lib/billing/get-pricing-plans-marketing';
import { usePublicBillingCurrency } from '@gitroom/frontend/lib/billing/use-public-billing-currency';
import { formatPlanPrice } from '@gitroom/frontend/lib/billing/currency-display';

// `plans` comes from the parent server component ((marketing)/page.tsx)
// via getMarketingPricingPlans() - same data source as the /pricing page's
// cards, so the two can never drift the way the old hand-maintained
// MARKETING_TIERS mirror could. Still a client component purely so the
// price shown can be currency-converted without making the whole home
// page dynamic just for that - see use-public-billing-currency.ts's doc
// comment for why this fetches the gateway/currency config client-side
// instead of reading VariableContext.
export const PricingTeaser = ({ plans }: { plans: MarketingPricingPlan[] }) => {
  const currency = usePublicBillingCurrency();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px]">
      {plans.map((tier) => (
        <Link
          key={tier.tier}
          href="/pricing"
          className="rounded-[14px] border border-fifth bg-newBgColorInner p-[20px] hover:border-btnPrimary transition-colors"
        >
          <p className="text-[14px] font-[600] text-textColor">
            {tier.displayName}
          </p>
          <p className="mt-[8px] text-[26px] font-[700] text-textColor -tracking-[0.5px]">
            {formatPlanPrice(tier.monthPrice, currency)}
            <span className="text-[13px] font-[500] text-gray">/mo</span>
          </p>
          <p className="mt-[4px] text-[12px] text-gray">
            {tier.channel} channels
          </p>
        </Link>
      ))}
    </div>
  );
};
