/**
 * RazorPay Standard Checkout (Checkout.js) - opened in a modal over the
 * current page for an already-created Subscription, instead of navigating
 * the browser to the Subscription's bare `short_url` page.
 *
 * Ported from the AutoGPT Platform codebase's
 * frontend/src/lib/payments/razorpayCheckout.ts, which documents the
 * production history behind this specific approach: an earlier version
 * that simply redirected to the Subscription's short_url stranded users on
 * checkout.razorpay.com with no way back, and a later `callback_url`
 * /`redirect: true` attempt proved fragile across real payment methods
 * (stuck token-processing states, OTP flows, UPI app-switches) because it
 * forces a full top-level navigation and relies on RazorPay POSTing back.
 * `handler` is RazorPay's own recommended alternative: Checkout.js keeps
 * the whole flow in its own overlay/popup and calls this JS function
 * directly once payment succeeds - no server-to-browser redirect involved.
 * We navigate to `successUrl` ourselves once `handler` fires.
 *
 * The subscription's actual tier update in the DB is handled entirely
 * separately by the subscription.activated/.charged webhook
 * (razorpay.controller.ts -> razorpay.service.ts), which doesn't depend on
 * the browser at all - this file's only job is to get the user back to a
 * page of this app once RazorPay reports success client-side.
 */

interface RazorpayCheckoutInstance {
  open(): void;
}

/** Passed directly to `handler` once a Checkout.js payment attempt
 * succeeds. Not verified client-side (nothing security-sensitive depends
 * on it here); the webhook independently verifies its own HMAC signature
 * before ever touching the DB. */
export interface RazorpayHandlerResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckoutOptions {
  key: string;
  subscription_id: string;
  name?: string;
  description?: string;
  handler?: (response: RazorpayHandlerResponse) => void;
  modal?: { ondismiss?: () => void };
}

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayCheckoutOptions
    ) => RazorpayCheckoutInstance;
  }
}

const CHECKOUT_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loadPromise: Promise<void> | null = null;

/** Loads RazorPay's Checkout.js exactly once per page, regardless of how
 * many times/places this is called from. */
export function loadRazorpayCheckoutScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('RazorPay Checkout can only be loaded in the browser')
    );
  }
  if (window.Razorpay) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load RazorPay Checkout'))
      );
      return;
    }
    const script = document.createElement('script');
    script.src = CHECKOUT_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load RazorPay Checkout'));
    document.head.appendChild(script);
  }).catch((error) => {
    // Let a failed load be retried on the next call instead of caching the
    // rejection forever (a transient network blip / ad-blocker hiccup
    // shouldn't permanently break checkout for the rest of the session).
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export interface OpenRazorpaySubscriptionCheckoutArgs {
  subscriptionId: string;
  keyId: string;
  /** Where the browser ends up after a successful (authorized) payment. */
  successUrl: string;
  /** Where the browser ends up if the user closes the modal without
   * paying. */
  cancelUrl: string;
}

/**
 * Opens the Standard Checkout modal for a Subscription that's already been
 * created server-side (`razorpay_subscription_id` + `razorpay_key_id` come
 * back from POST /billing/subscribe). Resolves once the modal has been
 * opened - it does NOT wait for the payment itself. The tab stays on this
 * app the whole time: Checkout.js keeps card/UPI/bank interactions inside
 * its own overlay or a self-closing popup and calls `handler` directly
 * once payment succeeds, or `modal.ondismiss` fires if the user closes it
 * without paying.
 */
export async function openRazorpaySubscriptionCheckout({
  subscriptionId,
  keyId,
  successUrl,
  cancelUrl,
}: OpenRazorpaySubscriptionCheckoutArgs): Promise<void> {
  await loadRazorpayCheckoutScript();
  if (!window.Razorpay) {
    throw new Error('RazorPay Checkout script did not load correctly');
  }

  const checkout = new window.Razorpay({
    key: keyId,
    subscription_id: subscriptionId,
    name: 'Vantly',
    // Fires once RazorPay reports the authorization payment succeeded -
    // entirely client-side, no browser navigation/redirect involved. The
    // actual DB update (tier) comes from the subscription.activated/
    // .charged webhook independently of this; this handler only needs to
    // get the user to successUrl.
    handler: () => {
      window.location.href = successUrl;
    },
    modal: {
      // Fires when the user closes the modal without completing payment
      // (no payment attempt exists for RazorPay to report on in this
      // case).
      ondismiss: () => {
        window.location.href = cancelUrl;
      },
    },
  });
  checkout.open();
}

export interface CheckoutResultLike {
  url?: string;
  razorpay_subscription_id?: string | null;
  razorpay_key_id?: string | null;
}

/**
 * Given a POST /billing/subscribe response, sends the browser into
 * whichever checkout flow it returned: RazorPay's Standard Checkout modal
 * when `razorpay_subscription_id`/`razorpay_key_id` are present, otherwise
 * a plain redirect to `url` (a Stripe Checkout Session, or - only if the
 * backend somehow couldn't supply the modal fields - RazorPay's bare
 * short_url as a last-resort fallback).
 */
export async function startCheckoutFromResponse(
  data: CheckoutResultLike,
  { successUrl, cancelUrl }: { successUrl: string; cancelUrl: string }
): Promise<void> {
  if (!data.url) return;
  if (data.razorpay_subscription_id && data.razorpay_key_id) {
    await openRazorpaySubscriptionCheckout({
      subscriptionId: data.razorpay_subscription_id,
      keyId: data.razorpay_key_id,
      successUrl,
      cancelUrl,
    });
    return;
  }
  window.location.href = data.url;
}
