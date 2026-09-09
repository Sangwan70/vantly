// Shared display-currency helpers for pricing UI, ported from
// vantly-ugc.com's lib/billing/currency-display.ts. Every USD price in this
// codebase (the PricingPlan table, admin-editable via Admin Panel -> Plans
// & Pricing - see pricing-plans.service.ts) is authored as a plain USD
// number - nothing about how prices are STORED or CHARGED changes here.
// This only affects how they're RENDERED when the active gateway is
// RazorPay (INR), using the rate resolved server-side by
// PaymentGatewaySettingsService.resolveCurrencyDisplay() and threaded down
// via VariableContext (apps/frontend/src/app/(app)/layout.tsx) for
// authenticated pages, or fetched directly from
// GET /public/billing/active-gateway for the provider-free (marketing)
// pages - see use-public-billing-currency.ts.
//
// IMPORTANT caveat for RazorPay/INR: this is a DISPLAY ESTIMATE computed
// from the admin-set (or fallback) exchange rate. The amount RazorPay
// actually charges is fixed by whichever RAZORPAY_{TIER}_PLAN_{PERIOD}
// Plan ID is configured in RazorPay's dashboard (see
// subscriptions/pricing.ts's own doc comment) - independent of this rate,
// and can drift from it if the two aren't kept in sync.

export interface CurrencyDisplayContext {
  currencySymbol: string;
  /** null when the active gateway is Stripe (USD, no conversion needed). */
  inrToUsdRate: number | null;
}

/** Format a raw USD dollar amount (a plan tier's month_price/year_price)
 * in the active display currency. */
export function formatPlanPrice(
  usdAmount: number,
  ctx: CurrencyDisplayContext
): string {
  if (ctx.inrToUsdRate === null) {
    return `${ctx.currencySymbol}${usdAmount.toFixed(usdAmount % 1 === 0 ? 0 : 2)}`;
  }
  const inrValue = usdAmount * ctx.inrToUsdRate;
  return `${ctx.currencySymbol}${inrValue.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;
}
