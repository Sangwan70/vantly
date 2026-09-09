'use client';

import { useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { MarketingPricingPlan } from '@gitroom/frontend/lib/billing/get-pricing-plans-marketing';
import { usePublicBillingCurrency } from '@gitroom/frontend/lib/billing/use-public-billing-currency';
import { formatPlanPrice } from '@gitroom/frontend/lib/billing/currency-display';

// `plans` comes from the server component (pricing/page.tsx) via
// getMarketingPricingPlans() - already filtered to active/purchasable,
// non-FREE tiers and sorted for display, so this component only renders,
// it never fetches or filters.
export const PricingCards = ({ plans }: { plans: MarketingPricingPlan[] }) => {
  const [yearly, setYearly] = useState(false);
  const currency = usePublicBillingCurrency();

  return (
    <div className="flex flex-col items-center gap-[40px]">
      <div className="flex items-center gap-[14px] bg-newBgColorInner border border-fifth rounded-full p-[4px]">
        <button
          type="button"
          onClick={() => setYearly(false)}
          className={clsx(
            'px-[18px] py-[8px] rounded-full text-[13px] font-[600] transition-colors',
            !yearly ? 'bg-btnPrimary text-white' : 'text-textColor/60'
          )}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setYearly(true)}
          className={clsx(
            'px-[18px] py-[8px] rounded-full text-[13px] font-[600] transition-colors',
            yearly ? 'bg-btnPrimary text-white' : 'text-textColor/60'
          )}
        >
          Yearly
          <span className="ml-[6px] text-[11px] font-[600] text-ai">
            save ~20%
          </span>
        </button>
      </div>

      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[20px]">
        {plans.map((tier) => {
          const displayPrice = yearly
            ? Math.round(tier.yearPrice / 12)
            : tier.monthPrice;
          return (
            <div
              key={tier.tier}
              className="relative flex flex-col rounded-[16px] border border-fifth bg-newBgColorInner p-[24px]"
            >
              {tier.badge && (
                <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-btnPrimary text-white text-[11px] font-[600] px-[12px] py-[4px]">
                  {tier.badge}
                </span>
              )}
              <p className="text-[16px] font-[600] text-textColor">
                {tier.displayName}
              </p>
              <div className="mt-[12px] flex items-end gap-[6px]">
                <span className="text-[36px] font-[700] text-textColor -tracking-[0.5px]">
                  {formatPlanPrice(displayPrice, currency)}
                </span>
                <span className="text-[13px] text-gray pb-[6px]">/ month</span>
              </div>
              <p className="text-[12px] text-gray mt-[2px]">
                {yearly
                  ? `Billed annually at ${formatPlanPrice(tier.yearPrice, currency)} / year`
                  : 'Billed monthly, cancel anytime'}
              </p>
              <Link
                href="/auth"
                className="mt-[20px] text-center text-[14px] font-[600] bg-btnPrimary text-white rounded-[8px] py-[10px] hover:opacity-90 transition-opacity"
              >
                Get started
              </Link>
              <ul className="mt-[24px] flex flex-col gap-[10px]">
                {tier.features.map((feature) => (
                  <li
                    key={feature}
                    className="text-[13px] leading-[1.5] text-textColor/75 flex items-start gap-[8px]"
                  >
                    <span className="text-ai shrink-0">&#10003;</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-[13px] text-gray text-center max-w-[560px]">
        Every plan starts with a free account &mdash; no card required to sign
        up. {currency.inrToUsdRate === null
          ? 'Prices shown in USD.'
          : 'Prices shown in INR - billed via RazorPay at checkout.'} Upgrade,
        downgrade, or cancel anytime from Settings &rarr; Billing.
      </p>
    </div>
  );
};
