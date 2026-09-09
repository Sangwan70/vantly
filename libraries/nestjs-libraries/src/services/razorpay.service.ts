import Razorpay from 'razorpay';
import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { OrganizationService } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.service';
import { BillingSubscribeDto } from '@gitroom/nestjs-libraries/dtos/billing/billing.subscribe.dto';
import { PricingPlansService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing-plans.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { PaymentGatewaySettingsService } from '@gitroom/nestjs-libraries/database/prisma/settings/payment-gateway-settings.service';

/**
 * RazorPay payment gateway integration - the INR-billing counterpart to
 * stripe.service.ts, selected at runtime via the PAYMENT_GATEWAY env var
 * (see payment.gateway.service.ts). Mirrors the architecture already proven
 * in the AutoGPT Platform codebase (real recurring RazorPay Subscriptions,
 * not one-shot Payment Links; a signature-verified webhook as the single
 * source of truth for tier changes), adapted to this codebase's
 * Organization-centric billing model (AutoGPT's is User-centric) and its
 * plain env-var plan-id configuration (no LaunchDarkly / admin-configurable
 * plan_config.py layer here - out of scope, see the delivery notes).
 *
 * Deliberate scope cuts vs. the AutoGPT reference, called out explicitly
 * rather than silently half-implemented:
 *  - No coupon/offer support (Stripe's checkDiscount/applyDiscount stay
 *    Stripe-only for now).
 *  - No trial support - `allowTrial` is accepted for signature parity with
 *    StripeService.subscribe but currently ignored; every RazorPay
 *    subscription starts billing immediately.
 *  - Reactivating an already-cancel-scheduled RazorPay subscription is NOT
 *    supported - RazorPay's Subscriptions API has no equivalent of Stripe's
 *    `cancel_at_period_end: false` toggle. cancelSubscription() below
 *    throws a clear, typed error in that case instead of silently no-oping;
 *    BillingController surfaces it so the user is told to start a new
 *    subscription instead.
 */

// How many billing cycles a RazorPay Subscription auto-charges before
// stopping on its own - the API has no "forever" option. A long-but-bounded
// horizon (10 years either way); cancelSubscription() below is the real way
// a subscription ends before that, driven by the customer or an admin.
const TOTAL_COUNT_BY_PERIOD: Record<'MONTHLY' | 'YEARLY', number> = {
  MONTHLY: 120,
  YEARLY: 10,
};

export type RazorpayTier = 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';

export interface RazorpaySubscriptionNotes {
  organizationId: string;
  userId: string;
  tier: RazorpayTier;
  period: 'MONTHLY' | 'YEARLY';
  uniqueId: string;
  service: 'vantly';
}

export class RazorpayReactivationUnsupportedError extends Error {
  constructor() {
    super(
      'Reactivating a cancelled RazorPay subscription is not supported - ' +
        'please start a new subscription instead.'
    );
    this.name = 'RazorpayReactivationUnsupportedError';
  }
}

@Injectable()
export class RazorpayService {
  private readonly _logger = new Logger(RazorpayService.name);

  // Lazily-built client, rebuilt only when the resolved key id changes -
  // avoids reconstructing the SDK client on every single call while still
  // picking up an admin credential change (Settings -> Payment Gateway)
  // without a restart.
  private _client: Razorpay | null = null;
  private _clientKeyId: string | null = null;

  constructor(
    private readonly _subscriptionService: SubscriptionService,
    private readonly _organizationService: OrganizationService,
    private readonly _paymentGatewaySettingsService: PaymentGatewaySettingsService,
    private readonly _pricingPlansService: PricingPlansService
  ) {}

  /** DB-first, env-fallback credential resolution - see
   * PaymentGatewaySettingsService.resolveRazorpayCredentials. */
  private resolveCredentials() {
    return this._paymentGatewaySettingsService.resolveRazorpayCredentials();
  }

  private async getClient(): Promise<Razorpay> {
    const creds = await this.resolveCredentials();
    const keyId = creds.keyId || '';
    if (!this._client || this._clientKeyId !== keyId) {
      this._client = new Razorpay({
        key_id: keyId,
        key_secret: creds.keySecret || '',
      });
      this._clientKeyId = keyId;
    }
    return this._client;
  }

  async isAvailable(): Promise<boolean> {
    const creds = await this.resolveCredentials();
    return !!(creds.keyId && creds.keySecret);
  }

  /** RazorPay's public Key ID - safe to expose client-side, required by
   * Checkout.js to open the payment modal. */
  async getKeyId(): Promise<string> {
    const creds = await this.resolveCredentials();
    return creds.keyId || '';
  }

  /**
   * Resolves the pre-created RazorPay Plan ID for a tier + billing cycle -
   * DB-first (Admin Panel -> Plans & Pricing -> RazorPay Plan ID fields),
   * falling back to the matching environment variable (e.g.
   * RAZORPAY_STANDARD_PLAN_MONTHLY) when unset - see
   * PricingPlansService.resolveRazorpayPlanId. Plans must be created ahead
   * of time in the RazorPay Dashboard (Subscriptions -> Plans) with the
   * real INR amount baked in - RazorPay has no API for "create a checkout
   * for $X", only "create a subscription against this pre-existing Plan".
   */
  async getPlanId(
    tier: RazorpayTier,
    period: 'MONTHLY' | 'YEARLY'
  ): Promise<string | undefined> {
    return this._pricingPlansService.resolveRazorpayPlanId(tier, period);
  }

  /**
   * Self-serve alternative to manually creating a Plan in RazorPay's own
   * Dashboard and pasting the id into Admin Panel -> Plans & Pricing (see
   * getPlanId's doc comment for why that manual step exists at all).
   * Mirrors vantly-ugc.com's mintMissingGatewayIds: SKIPS - never replaces
   * - a tier/period that already has a Plan id saved in the DB, since
   * RazorPay Plans are immutable once created and silently minting a
   * second one for the same tier/period would risk splitting existing
   * subscribers across two Plans at two different prices (see
   * schema.prisma's razorpayPlanIdMonthly doc comment). An env-var
   * fallback does NOT count as "already synced" here - this always fills
   * in the DB column so the price is visibly pinned in the admin UI
   * rather than left to whatever's in the environment.
   */
  async syncPlanId(
    tier: RazorpayTier,
    period: 'MONTHLY' | 'YEARLY',
    updatedBy: string
  ): Promise<{ planId: string; created: boolean }> {
    const row = await this._pricingPlansService.getByTier(tier);
    const dbValue =
      period === 'MONTHLY'
        ? row?.razorpayPlanIdMonthly
        : row?.razorpayPlanIdYearly;
    if (dbValue) {
      return { planId: dbValue, created: false };
    }

    if (!(await this.isAvailable())) {
      throw new Error(
        'RazorPay credentials are not configured - set them in Settings -> Payment Gateway first.'
      );
    }

    const amountUsd = period === 'MONTHLY' ? row?.monthPrice : row?.yearPrice;
    if (!amountUsd || amountUsd <= 0) {
      throw new Error(
        `${row?.displayName || tier} has no ${
          period === 'MONTHLY' ? 'monthly' : 'yearly'
        } price set above $0 - set a price in Plans & Pricing before ` +
          `creating a RazorPay Plan.`
      );
    }

    const client = await this.getClient();
    const rate = await this._paymentGatewaySettingsService.getInrToUsdRate();
    const amountPaise = Math.round(amountUsd * rate * 100);

    const plan = await client.plans.create({
      period: period === 'MONTHLY' ? 'monthly' : 'yearly',
      interval: 1,
      item: {
        name: `${row?.displayName || tier} (${
          period === 'MONTHLY' ? 'Monthly' : 'Yearly'
        })`,
        amount: amountPaise,
        currency: 'INR',
      },
      // Every field here must be a string - RazorPay's notes API does not
      // accept nested objects/numbers (same constraint as subscribe()'s
      // notes below).
      notes: { tier, period, service: 'vantly' } as unknown as Record<
        string,
        string
      >,
    } as any);

    await this._pricingPlansService.setRazorpayPlanId(
      tier,
      period,
      plan.id,
      updatedBy
    );
    return { planId: plan.id, created: true };
  }

  /**
   * RazorPay has no "Customer" object the way Stripe does (subscriptions
   * are created directly against a Plan). organization.paymentId is reused
   * across both gateways as a generic "external billing key for this org"
   * (see the field's comment in schema.prisma) - for RazorPay orgs it's
   * simply a stable synthetic value, never sent to RazorPay itself, that
   * lets the existing paymentId-keyed helpers in SubscriptionRepository
   * (getOrganizationByCustomerId, deleteSubscriptionByCustomerId, etc.)
   * keep working unmodified for both gateways.
   */
  private async getOrCreateCustomerKey(organization: Organization): Promise<string> {
    if (organization.paymentId) {
      return organization.paymentId;
    }
    const customerKey = `rzp_${organization.id}`;
    await this._subscriptionService.updateCustomerId(organization.id, customerKey);
    return customerKey;
  }

  /**
   * Creates a real RazorPay Subscription (recurring billing) for a tier and
   * returns the checkout details the frontend needs to open RazorPay
   * Standard Checkout (Checkout.js) in a modal - see
   * apps/frontend/src/lib/payments/razorpay-checkout.ts. Mirrors
   * StripeService.subscribe()'s signature so BillingController can select
   * between the two gateways with a single branch.
   */
  async subscribe(
    uniqueId: string,
    organizationId: string,
    userId: string,
    body: BillingSubscribeDto,
    _allowTrial: boolean
  ): Promise<{
    url: string;
    razorpay_subscription_id: string;
    razorpay_key_id: string;
  }> {
    if (!(await this.isAvailable())) {
      throw new Error('RazorPay is not configured (missing API key/secret)');
    }

    const tier = body.billing as RazorpayTier;
    const planId = await this.getPlanId(tier, body.period);
    if (!planId) {
      throw new Error(
        `No RazorPay Plan ID configured for tier ${tier} (${body.period}) - ` +
          `set RAZORPAY_${tier}_PLAN_${body.period} in your environment.`
      );
    }

    const org = await this._organizationService.getOrgById(organizationId);
    if (!org) {
      throw new Error(`Organization ${organizationId} not found`);
    }
    await this.getOrCreateCustomerKey(org);

    const notes: RazorpaySubscriptionNotes = {
      organizationId,
      userId,
      tier,
      period: body.period,
      uniqueId,
      service: 'vantly',
    };

    const client = await this.getClient();
    const subscription = await client.subscriptions.create({
      plan_id: planId,
      total_count: TOTAL_COUNT_BY_PERIOD[body.period],
      quantity: 1,
      customer_notify: 1,
      // Every field here must be a string - RazorPay's notes API does not
      // accept nested objects/numbers.
      notes: notes as unknown as Record<string, string>,
    });

    if (!subscription.id || !subscription.short_url) {
      throw new Error('RazorPay subscription created but missing id/short_url');
    }

    await this._organizationService.updateRazorpaySubscription(
      organizationId,
      subscription.id,
      subscription.status
    );

    return {
      url: subscription.short_url,
      razorpay_subscription_id: subscription.id,
      razorpay_key_id: await this.getKeyId(),
    };
  }

  /**
   * Cancels a user's live RazorPay subscription (cancel_at_cycle_end: true
   * by default - access continues until the already-paid-for cycle ends,
   * matching StripeService.setToCancel's behavior). Returns the same
   * { id, cancel_at } shape the frontend already expects from
   * POST /billing/cancel.
   *
   * Throws RazorpayReactivationUnsupportedError if `reactivate` is true -
   * see this file's top docstring for why that's not implemented.
   */
  async setToCancel(
    organizationId: string,
    reactivate = false
  ): Promise<{ id: string; cancel_at?: Date }> {
    if (reactivate) {
      throw new RazorpayReactivationUnsupportedError();
    }

    const org = await this._organizationService.getOrgById(organizationId);
    const subscriptionId = org?.razorpaySubscriptionId;
    if (!org || !subscriptionId) {
      throw new Error('No active RazorPay subscription found for this organization');
    }

    const id = makeId(10);

    try {
      const client = await this.getClient();
      const result = await client.subscriptions.cancel(subscriptionId, true);
      await this._organizationService.updateRazorpaySubscription(
        organizationId,
        subscriptionId,
        result.status || 'cancelled'
      );
      return {
        id,
        cancel_at: result.current_end ? new Date(result.current_end * 1000) : undefined,
      };
    } catch (e: any) {
      // RazorPay 400s a cancel call once the subscription is already in a
      // terminal state ("... is not cancellable in cancelled status" /
      // "completed" / "expired") - this is not a real failure, the end
      // state we wanted (not billing the user anymore) already holds. Same
      // reasoning as the AutoGPT reference implementation.
      const message = e?.error?.description || e?.message || String(e);
      if (/not cancellable in/i.test(message)) {
        this._logger.warn(
          `RazorPay subscription ${subscriptionId} for org ${organizationId} was already terminal (${message})`
        );
        await this._organizationService.updateRazorpaySubscription(
          organizationId,
          subscriptionId,
          'cancelled'
        );
        return { id, cancel_at: new Date() };
      }
      this._logger.error(
        `Failed to cancel RazorPay subscription ${subscriptionId} for org ${organizationId}: ${message}`
      );
      throw e;
    }
  }

  /** Verifies RazorPay's `X-Razorpay-Signature` webhook header. Fails
   * CLOSED (rejects) when RAZORPAY_WEBHOOK_SECRET isn't configured - an
   * unset secret must never be treated as "verification not required". */
  verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    if (!secret) {
      this._logger.error(
        'RAZORPAY_WEBHOOK_SECRET not configured - rejecting webhook (fail closed, not open)'
      );
      return false;
    }
    if (!signature) {
      return false;
    }
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      // Length mismatch between expected/received - definitely not equal.
      return false;
    }
  }

  /** Unwraps a RazorPay webhook sub-payload. RazorPay nests every object
   * under an "entity" key: payload.payload[key].entity - NOT
   * payload.payload[key] directly. Missing this unwrap means every field
   * read off the result is silently empty (a real bug in the AutoGPT
   * reference implementation before it was fixed there). */
  private entity(payload: any, key: string): any {
    return payload?.payload?.[key]?.entity || {};
  }

  /**
   * subscription.activated (first successful charge) and
   * subscription.charged (every renewal) both mean: the subscription is
   * live and paid through - resolve the org and make sure its tier/tracking
   * fields reflect that. Reuses the exact same
   * SubscriptionService.createOrUpdateSubscription(...) path Stripe's
   * webhook already calls, so both gateways share one subscription-write
   * code path.
   */
  async handleSubscriptionActivatedOrCharged(payload: any): Promise<void> {
    const subEntity = this.entity(payload, 'subscription');
    const subId = subEntity.id;
    if (!subId) {
      this._logger.warn('RazorPay subscription webhook missing subscription id, skipping');
      return;
    }

    const org = await this.resolveOrgForSubscription(subEntity);
    if (!org) {
      this._logger.warn(`Could not resolve organization for RazorPay subscription ${subId}`);
      return;
    }

    await this._organizationService.updateRazorpaySubscription(
      org.id,
      subId,
      subEntity.status
    );

    const notes = (subEntity.notes || {}) as Partial<RazorpaySubscriptionNotes>;
    const tier = notes.tier as RazorpayTier | undefined;
    const period = (notes.period as 'MONTHLY' | 'YEARLY') || 'MONTHLY';
    const uniqueId = notes.uniqueId || makeId(10);

    const pricing = await this._pricingPlansService.getPricingMap();
    if (!tier || !pricing[tier]) {
      this._logger.warn(
        `RazorPay subscription ${subId} activated/charged but notes.tier (${tier}) is missing or unknown - not updating subscription tier`
      );
      return;
    }

    const customerId = await this.getOrCreateCustomerKey(org);
    await this._subscriptionService.createOrUpdateSubscription(
      false,
      uniqueId,
      customerId,
      pricing[tier].channel!,
      tier,
      period,
      null,
      undefined,
      org.id
    );
  }

  /**
   * subscription.cancelled / .completed / .halted all mean the subscription
   * has stopped auto-charging - downgrade to FREE. Guarded against
   * stale/out-of-order webhook delivery exactly like the AutoGPT reference:
   * only act if the org's CURRENT razorpaySubscriptionId still matches this
   * event's subscription id, so a late cancellation for an OLD subscription
   * (superseded by a tier change) can't clobber a newer one.
   */
  async handleSubscriptionEnded(payload: any, event: string): Promise<void> {
    const subEntity = this.entity(payload, 'subscription');
    const subId = subEntity.id;
    if (!subId) {
      this._logger.warn(`RazorPay ${event} missing subscription id, skipping`);
      return;
    }

    const org = await this.resolveOrgForSubscription(subEntity);
    if (!org) {
      this._logger.warn(`Could not resolve organization for ended RazorPay subscription ${subId}`);
      return;
    }

    if (org.razorpaySubscriptionId !== subId) {
      this._logger.log(
        `Ignoring ${event} for superseded RazorPay subscription ${subId} (org ${org.id}'s current subscription is ${org.razorpaySubscriptionId})`
      );
      return;
    }

    const status = subEntity.status || event.split('.').pop();
    await this._organizationService.updateRazorpaySubscription(org.id, subId, status);

    const customerId = await this.getOrCreateCustomerKey(org);
    await this._subscriptionService.deleteSubscription(customerId);
  }

  /** Resolves the org a subscription.* webhook event is for: first via
   * notes.organizationId (set at subscription-creation time, echoed back
   * verbatim on every event), falling back to the stored
   * razorpaySubscriptionId in case notes ever come back empty. */
  private async resolveOrgForSubscription(subEntity: any): Promise<Organization | null> {
    const notes = subEntity?.notes || {};
    const organizationId = notes.organizationId;
    if (organizationId) {
      const org = await this._organizationService.getOrgById(organizationId);
      if (org) return org;
    }
    const subId = subEntity?.id;
    if (!subId) return null;
    return this._organizationService.getOrgByRazorpaySubscriptionId(subId);
  }
}
