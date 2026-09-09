export interface BillingConfig {
  activeGateway: 'stripe' | 'razorpay';
  currencySymbol: string;
  inrToUsdRate: number | null;
  razorpayKeyId: string;
  billingEnabled: boolean;
}

// Everything a server layout needs to know about the active gateway,
// resolved the same way the backend resolves it (Settings -> Payment
// Gateway admin override, DB-first, else env vars, else razorpay/USD) -
// see payment-gateway-settings.service.ts's resolvePublicBillingConfig().
// Reading process.env.PAYMENT_GATEWAY / RAZORPAY_API_KEY / STRIPE_
// PUBLISHABLE_KEY directly here would ignore any admin override made
// through the Admin Panel (a DB-only RazorPay key with no env var set,
// for instance), since this app has no direct DB access of its own - it
// only talks to the backend over HTTP. Falls back to the same
// env-var-driven defaults if the backend call itself fails, so a
// slow/unreachable backend degrades to "best guess" rather than breaking
// the whole page.
//
// Shared by every server layout that needs `billingEnabled` - originally
// only (app)/layout.tsx computed this correctly; (provider)/layout.tsx and
// (extension)/layout.tsx used a bare `!!process.env.STRIPE_PUBLISHABLE_KEY`
// which reads "billing off" on any deployment running RazorPay instead of
// Stripe (see PaymentGatewaySettingsService.isBillingEnforced's doc
// comment for the backend half of this same bug).
export async function resolveBillingConfig(): Promise<BillingConfig> {
  const fallbackGateway =
    process.env.PAYMENT_GATEWAY === 'stripe' ? 'stripe' : 'razorpay';
  const fallback: BillingConfig = {
    activeGateway: fallbackGateway,
    currencySymbol: fallbackGateway === 'razorpay' ? '₹' : '$',
    inrToUsdRate: null,
    razorpayKeyId: process.env.RAZORPAY_API_KEY || '',
    billingEnabled:
      fallbackGateway === 'razorpay'
        ? !!process.env.RAZORPAY_API_KEY
        : !!process.env.STRIPE_PUBLISHABLE_KEY,
  };
  try {
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/public/billing/active-gateway`,
      { cache: 'no-store' }
    );
    if (!res.ok) return fallback;
    const data = (await res.json()) as Partial<BillingConfig>;
    return {
      activeGateway: data.activeGateway === 'stripe' ? 'stripe' : 'razorpay',
      currencySymbol: data.currencySymbol || fallback.currencySymbol,
      inrToUsdRate: data.inrToUsdRate ?? null,
      razorpayKeyId: data.razorpayKeyId ?? fallback.razorpayKeyId,
      billingEnabled: data.billingEnabled ?? fallback.billingEnabled,
    };
  } catch {
    return fallback;
  }
}
