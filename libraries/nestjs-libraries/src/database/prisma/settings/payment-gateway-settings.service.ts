import { Injectable } from '@nestjs/common';
import {
  PaymentGatewaySettingsRepository,
  PaymentGatewayCredentialsPatch,
} from '@gitroom/nestjs-libraries/database/prisma/settings/payment-gateway-settings.repository';
import { PaymentGatewaySettingsDto } from '@gitroom/nestjs-libraries/dtos/settings/payment-gateway-settings.dto';

export type GatewayId = 'stripe' | 'razorpay';

// Mirrors vantly-ugc.com's lib/billing/gateway-settings.ts CredentialSource:
// 'database' (an admin filled this in via the Admin Panel - always wins),
// 'env' (falling back to the deploy-time env var), or 'none' (gateway is
// unusable until one of the two is set).
export type CredentialSource = 'database' | 'env' | 'none';

export interface ResolvedStripeCredentials {
  secretKey: string | null;
  source: CredentialSource;
}

export interface ResolvedRazorpayCredentials {
  keyId: string | null;
  keySecret: string | null;
  source: CredentialSource;
}

export interface PaymentGatewayPublicSettings {
  activeGateway: GatewayId;
  isOverridden: boolean;
  stripe: { set: boolean; source: CredentialSource };
  razorpay: { set: boolean; source: CredentialSource };
  currency: { inrToUsdRate: number; isDefault: boolean };
}

export interface CurrencyDisplay {
  currencyCode: 'USD' | 'INR';
  currencySymbol: string;
  /** null when the active gateway is Stripe (USD, no conversion needed). */
  inrToUsdRate: number | null;
}

export interface PublicBillingConfig extends CurrencyDisplay {
  activeGateway: GatewayId;
  /** RazorPay's public Key ID - safe to expose client-side, required by
   * Checkout.js to open the payment modal. Empty string when RazorPay has
   * no usable credentials (DB or env). */
  razorpayKeyId: string;
  /** Whether the currently active gateway actually has usable credentials
   * (DB-first, env-fallback) - lets the frontend show "billing
   * unavailable" instead of a broken checkout button. */
  billingEnabled: boolean;
}

// Used only to render an ESTIMATED INR price on marketing/billing pages -
// never affects what RazorPay actually charges (see schema.prisma's
// PaymentGatewaySettings.inrToUsdRate doc comment). Better to show a
// roughly-right estimate than none at all before an admin sets the real
// rate in Settings -> Payment Gateway. 94 is Vantly's own chosen default
// (deliberately different from vantly-ugc.com's rate).
export const FALLBACK_INR_TO_USD_RATE = 94;

function trimmed(v: string | null | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

/**
 * Admin-configurable payment gateway settings: which gateway new
 * subscriptions go through, plus (as of this feature) the Stripe/RazorPay
 * credentials themselves - ported from vantly-ugc.com's Settings ->
 * Payment Gateways admin surface. DB value always wins over the matching
 * env var when set; falls back to the env var, and finally to hard defaults
 * (razorpay as the active gateway, "not configured" for credentials), so a
 * fresh install with nothing configured behaves exactly as it did before
 * this feature existed.
 *
 * This only decides the gateway/credentials for a brand-new subscription
 * or a fresh gateway API call. It must NEVER be used to decide which
 * gateway services an *existing* organization's subscription
 * (cancel/portal/etc.) - that has to be resolved from the organization's
 * own state (see billing.controller.ts's isOrgOnRazorpay()), otherwise
 * flipping this toggle or rotating a key would silently misroute actions
 * for whichever gateway current subscribers are actually on.
 */
@Injectable()
export class PaymentGatewaySettingsService {
  constructor(
    private _paymentGatewaySettingsRepository: PaymentGatewaySettingsRepository
  ) {}

  getSettings() {
    return this._paymentGatewaySettingsRepository.getSettings();
  }

  async updateSettings(body: PaymentGatewaySettingsDto) {
    await this._paymentGatewaySettingsRepository.setActiveGateway(
      body.activeGateway ?? null
    );

    // Secrets only change when a non-empty value is submitted or the
    // matching clear flag is set - re-saving the form without touching a
    // credential field must never overwrite the stored secret with blank.
    const patch: PaymentGatewayCredentialsPatch = {};

    if (body.clearStripeSecretKey) {
      patch.stripeSecretKey = null;
    } else if (body.stripeSecretKey?.trim()) {
      patch.stripeSecretKey = body.stripeSecretKey.trim();
    }

    if (body.clearRazorpayCredentials) {
      patch.razorpayKeyId = null;
      patch.razorpayKeySecret = null;
    } else if (body.razorpayKeyId?.trim() && body.razorpayKeySecret?.trim()) {
      patch.razorpayKeyId = body.razorpayKeyId.trim();
      patch.razorpayKeySecret = body.razorpayKeySecret.trim();
    }

    // inrToUsdRate: undefined means "leave unchanged" (the field wasn't
    // part of this PUT at all), null explicitly resets to the fallback
    // rate, and a positive number sets an admin override - see the DTO's
    // doc comment for the same null-clears convention used by
    // activeGateway.
    if (body.inrToUsdRate !== undefined) {
      patch.inrToUsdRate = body.inrToUsdRate;
    }

    if (Object.keys(patch).length) {
      await this._paymentGatewaySettingsRepository.patch(patch);
    }

    return this.getPublicSettings();
  }

  async resolveActiveGateway(): Promise<GatewayId> {
    const row = await this._paymentGatewaySettingsRepository.getSettings();
    if (row?.activeGateway === 'stripe' || row?.activeGateway === 'razorpay') {
      return row.activeGateway;
    }

    return process.env.PAYMENT_GATEWAY === 'stripe' ? 'stripe' : 'razorpay';
  }

  async isRazorpayActive(): Promise<boolean> {
    return (await this.resolveActiveGateway()) === 'razorpay';
  }

  /** DB-first, env-fallback Stripe secret key resolution - used by
   * StripeService to build its API client instead of reading
   * process.env.STRIPE_SECRET_KEY directly. */
  async resolveStripeCredentials(): Promise<ResolvedStripeCredentials> {
    const row = await this._paymentGatewaySettingsRepository.getSettings();
    const dbKey = trimmed(row?.stripeSecretKey);
    if (dbKey) return { secretKey: dbKey, source: 'database' };
    if (process.env.STRIPE_SECRET_KEY) {
      return { secretKey: process.env.STRIPE_SECRET_KEY, source: 'env' };
    }
    return { secretKey: null, source: 'none' };
  }

  /** DB-first, env-fallback RazorPay key id/secret resolution - used by
   * RazorpayService instead of reading RAZORPAY_API_KEY/SECRET directly.
   * Both halves of the pair must come from the same source: a lone DB key
   * id with no DB secret (or vice versa) is treated as not-yet-configured
   * from the DB and falls through to the env pair. */
  async resolveRazorpayCredentials(): Promise<ResolvedRazorpayCredentials> {
    const row = await this._paymentGatewaySettingsRepository.getSettings();
    const dbKeyId = trimmed(row?.razorpayKeyId);
    const dbKeySecret = trimmed(row?.razorpayKeySecret);
    if (dbKeyId && dbKeySecret) {
      return { keyId: dbKeyId, keySecret: dbKeySecret, source: 'database' };
    }
    if (process.env.RAZORPAY_API_KEY && process.env.RAZORPAY_API_SECRET) {
      return {
        keyId: process.env.RAZORPAY_API_KEY,
        keySecret: process.env.RAZORPAY_API_SECRET,
        source: 'env',
      };
    }
    return { keyId: null, keySecret: null, source: 'none' };
  }

  /** The admin-set INR-per-USD display rate (Settings -> Payment
   * Gateway), or FALLBACK_INR_TO_USD_RATE if never set - independent of
   * which gateway is currently active, so a RazorPay Plan can be priced
   * correctly even while Stripe is the active gateway (e.g. preparing
   * RazorPay ahead of a switch). resolveCurrencyDisplay() and
   * getPublicSettings() both delegate here rather than each re-deriving
   * the same fallback logic. */
  async getInrToUsdRate(): Promise<number> {
    const row = await this._paymentGatewaySettingsRepository.getSettings();
    return row?.inrToUsdRate && row.inrToUsdRate > 0
      ? row.inrToUsdRate
      : FALLBACK_INR_TO_USD_RATE;
  }

  /** DB-first, env-fallback display-currency resolution: USD (no
   * conversion) when Stripe is active, INR (using the admin-set rate, or
   * FALLBACK_INR_TO_USD_RATE if unset) when RazorPay is active. Purely for
   * rendering - see this file's other doc comments for why it never
   * affects what RazorPay actually charges. */
  async resolveCurrencyDisplay(): Promise<CurrencyDisplay> {
    const activeGateway = await this.resolveActiveGateway();
    if (activeGateway !== 'razorpay') {
      return { currencyCode: 'USD', currencySymbol: '$', inrToUsdRate: null };
    }

    const rate = await this.getInrToUsdRate();
    return { currencyCode: 'INR', currencySymbol: '\u20b9', inrToUsdRate: rate };
  }

  /** Shape returned to public, unauthenticated frontend code (GET
   * /public/billing/active-gateway) - everything the marketing pages and
   * the app shell need to render prices and the RazorPay checkout widget
   * without exposing any secret. */
  async resolvePublicBillingConfig(): Promise<PublicBillingConfig> {
    const [activeGateway, currency, stripeCreds, razorpayCreds] = await Promise.all([
      this.resolveActiveGateway(),
      this.resolveCurrencyDisplay(),
      this.resolveStripeCredentials(),
      this.resolveRazorpayCredentials(),
    ]);

    const billingEnabled =
      activeGateway === 'razorpay'
        ? !!(razorpayCreds.keyId && razorpayCreds.keySecret)
        : !!stripeCreds.secretKey;

    return {
      activeGateway,
      ...currency,
      razorpayKeyId: razorpayCreds.keyId || '',
      billingEnabled,
    };
  }

  /**
   * Whether billing is actually enforced right now: true only when the
   * CURRENTLY ACTIVE gateway (Stripe or RazorPay - see
   * resolveActiveGateway) has real, usable credentials (DB or env).
   *
   * Before RazorPay existed, every plan-limit/permission check in this
   * codebase used a bare `!!process.env.STRIPE_PUBLISHABLE_KEY` as a proxy
   * for "is this a self-hosted/dev install with billing turned off" - if
   * unset, treat everyone as unlimited/ULTIMATE. That was fine when Stripe
   * was the only gateway, but a deployment that configures RazorPay
   * instead of Stripe never sets STRIPE_PUBLISHABLE_KEY at all, so every
   * one of those checks silently misread "billing IS configured, just not
   * via Stripe" as "billing is off" - granting every user free ULTIMATE
   * access and skipping plan-limit enforcement app-wide. This method
   * replaces that env var read everywhere it was being used as a
   * billing-on/off switch (see call sites), while preserving the original
   * intent for a genuinely unconfigured install (no gateway credentials
   * anywhere): still treated as billing-off, exactly as before.
   */
  async isBillingEnforced(): Promise<boolean> {
    const activeGateway = await this.resolveActiveGateway();
    if (activeGateway === 'stripe') {
      const stripe = await this.resolveStripeCredentials();
      return !!stripe.secretKey;
    }
    const razorpay = await this.resolveRazorpayCredentials();
    return !!(razorpay.keyId && razorpay.keySecret);
  }

  /** Shape returned to the admin UI (GET/PUT /admin/settings/payment-gateway)
   * - secrets never appear here, only a `set`/`source` indicator per
   * credential, mirroring vantly-ugc.com's Payment Gateways tab so a value
   * once saved never round-trips back to the browser. */
  async getPublicSettings(): Promise<PaymentGatewayPublicSettings> {
    const [row, activeGateway, stripeCreds, razorpayCreds] = await Promise.all([
      this._paymentGatewaySettingsRepository.getSettings(),
      this.resolveActiveGateway(),
      this.resolveStripeCredentials(),
      this.resolveRazorpayCredentials(),
    ]);

    return {
      activeGateway,
      isOverridden:
        row?.activeGateway === 'stripe' || row?.activeGateway === 'razorpay',
      stripe: { set: !!stripeCreds.secretKey, source: stripeCreds.source },
      razorpay: {
        set: !!(razorpayCreds.keyId && razorpayCreds.keySecret),
        source: razorpayCreds.source,
      },
      currency: {
        inrToUsdRate:
          row?.inrToUsdRate && row.inrToUsdRate > 0
            ? row.inrToUsdRate
            : FALLBACK_INR_TO_USD_RATE,
        isDefault: !(row?.inrToUsdRate && row.inrToUsdRate > 0),
      },
    };
  }
}
