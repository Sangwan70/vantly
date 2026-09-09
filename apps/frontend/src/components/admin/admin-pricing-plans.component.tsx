'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Textarea } from '@gitroom/react/form/textarea';
import { Checkbox } from '@gitroom/react/form/checkbox';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { usePublicBillingCurrency } from '@gitroom/frontend/lib/billing/use-public-billing-currency';
import { formatPlanPrice } from '@gitroom/frontend/lib/billing/currency-display';

interface PricingPlanRow {
  tier: string;
  displayName: string;
  description?: string | null;
  badge?: string | null;
  features: string[];
  monthPrice: number;
  yearPrice: number;
  channel: number;
  postsPerMonth: number;
  teamMembers: boolean;
  communityFeatures: boolean;
  featuredByGitroom: boolean;
  ai: boolean;
  importFromChannels: boolean;
  imageGenerator: boolean;
  imageGenerationCount: number;
  generateVideos: number;
  youtubeTextSuggestions: number;
  publicApi: boolean;
  webhooks: number;
  autoPost: boolean;
  razorpayPlanIdMonthly?: string | null;
  razorpayPlanIdYearly?: string | null;
  isActive: boolean;
  isPurchasable: boolean;
  sortOrder: number;
  // False only in the impossible case the fixed 5-tier list somehow
  // returned nothing for this slug - every tier always has a row (unlike
  // Content Management's optional per-page override), so this is really
  // just a defensive type, not something the UI branches on.
  customized: boolean;
}

const PLANS_KEY = '/admin/pricing-plans';

// Its own hook per CLAUDE.md's SWR rule - one useSWR call per hook.
const usePricingPlansAdmin = () => {
  const fetch = useFetch();
  return useSWR<PricingPlanRow[]>(
    PLANS_KEY,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load pricing plans');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

// Fixed, known set of tiers - mirrors PRICING_PLAN_TIERS on the backend.
// FREE has no price/checkout of its own (it's the pre-subscription state,
// same convention the billing pages already use) so it never appears on
// the public /pricing page, but its channel/feature limits still gate the
// free tier elsewhere in the app, so it's still editable here.
const TIER_ORDER = ['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'];
const TIER_LABELS: Record<string, string> = {
  FREE: 'Free',
  STANDARD: 'Standard',
  TEAM: 'Team',
  PRO: 'Pro',
  ULTIMATE: 'Ultimate',
};

const blankPlanForm = (tier: string): PricingPlanRow => ({
  tier,
  displayName: TIER_LABELS[tier] || tier,
  description: '',
  badge: '',
  features: [],
  monthPrice: 0,
  yearPrice: 0,
  channel: 0,
  postsPerMonth: 0,
  teamMembers: false,
  communityFeatures: false,
  featuredByGitroom: false,
  ai: false,
  importFromChannels: false,
  imageGenerator: false,
  imageGenerationCount: 0,
  generateVideos: 0,
  youtubeTextSuggestions: 0,
  publicApi: false,
  webhooks: 0,
  autoPost: false,
  razorpayPlanIdMonthly: '',
  razorpayPlanIdYearly: '',
  isActive: true,
  isPurchasable: true,
  sortOrder: 0,
  customized: false,
});


const PricingPlanEditor: FC<{
  plan: PricingPlanRow;
  onReverted: () => void;
}> = ({ plan, onReverted }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const currency = usePublicBillingCurrency();
  const [form, setForm] = useState<PricingPlanRow>(plan);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const set = useCallback(
    <K extends keyof PricingPlanRow>(key: K, value: PricingPlanRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const featuresText = useMemo(
    () => (form.features || []).join('\n'),
    [form.features]
  );

  const priceChanged =
    form.monthPrice !== plan.monthPrice || form.yearPrice !== plan.yearPrice;

  const handleSave = useCallback(async () => {
    if (priceChanged) {
      const proceed = window.confirm(
        `This changes the monthly/yearly price shown on the site. Stripe ` +
          `automatically charges the new amount on the next checkout - no ` +
          `further action needed there. RazorPay Plans are immutable once ` +
          `created though: the existing RAZORPAY_${form.tier}_PLAN_* Plan ` +
          `(or the RazorPay Plan ID fields below, if set) will keep charging ` +
          `the OLD amount until you create a new Plan in the RazorPay ` +
          `Dashboard for the new price and paste its id into the fields ` +
          `below. Continue saving?`
      );
      if (!proceed) return;
    }
    setSaving(true);
    try {
      await fetch(`${PLANS_KEY}/${form.tier}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await mutate(PLANS_KEY);
      // Reflect the save locally right away rather than waiting on a tab
      // switch's key-triggered remount to pick up the refreshed list - see
      // admin-content.component.tsx's PageEditor.handleSave for the same
      // fix applied there.
      setForm((prev) => ({ ...prev, customized: true }));
      toast.show('Plan saved', 'success');
    } catch {
      toast.show('Failed to save plan', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form, priceChanged]);

  const handleRevert = useCallback(async () => {
    if (
      !window.confirm(
        `Reset ${form.tier} back to its original price, features, and ` +
          `limits? This discards any admin edits made to this plan.`
      )
    ) {
      return;
    }
    setReverting(true);
    try {
      await fetch(`${PLANS_KEY}/${form.tier}/revert`, { method: 'POST' });
      await mutate(PLANS_KEY);
      onReverted();
      toast.show('Plan reset to default', 'success');
    } catch {
      toast.show('Failed to reset plan', 'warning');
    } finally {
      setReverting(false);
    }
  }, [form.tier]);

  const handleSyncRazorpay = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${PLANS_KEY}/${form.tier}/sync-razorpay`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to sync with RazorPay');
      }
      const result = await res.json();
      setForm((prev) => ({
        ...prev,
        razorpayPlanIdMonthly: result.razorpayPlanIdMonthly,
        razorpayPlanIdYearly: result.razorpayPlanIdYearly,
      }));
      await mutate(PLANS_KEY);
      toast.show(
        result.createdMonthly || result.createdYearly
          ? 'RazorPay Plan(s) created and saved'
          : 'Already in sync - both Plan IDs were already set',
        'success'
      );
    } catch (e) {
      toast.show(
        e instanceof Error ? e.message : 'Failed to sync with RazorPay',
        'warning'
      );
    } finally {
      setSyncing(false);
    }
  }, [form.tier]);

  const monthlyPreview = formatPlanPrice(form.monthPrice || 0, currency);
  const yearlyPreview = formatPlanPrice(form.yearPrice || 0, currency);

  // USD is the single stored source of truth (Stripe checkout,
  // feature-gating all read it directly - see pricing-plans.service.ts).
  // When RazorPay is the active gateway though, editing a raw USD number
  // here is meaningless to an admin who thinks in rupees, so the box
  // itself displays/accepts INR and these two helpers do the round-trip
  // conversion at the moment of typing - the underlying form.monthPrice/
  // yearPrice fields (and what gets PUT to the backend) are always USD.
  // Because the displayed value is derived from currency + the stored USD
  // number on every render rather than kept as separate state, switching
  // the gateway or changing the rate on Settings -> Payment Gateway
  // instantly re-populates this box with the freshly converted number the
  // next time this page reads the currency (no extra save/refresh step).
  const toDisplayPrice = useCallback(
    (usd: number) =>
      currency.inrToUsdRate !== null
        ? String(Math.round(usd * currency.inrToUsdRate))
        : String(usd),
    [currency.inrToUsdRate]
  );
  const fromDisplayPrice = useCallback(
    (displayValue: string): number => {
      const parsed = Number(displayValue) || 0;
      if (currency.inrToUsdRate === null) return parsed;
      return Math.round((parsed / currency.inrToUsdRate) * 100) / 100;
    },
    [currency.inrToUsdRate]
  );

  return (
    <div className="flex flex-col gap-[16px] border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-[600]">
          {TIER_LABELS[form.tier] || form.tier}
        </div>
        <div
          className={`text-[11px] uppercase tracking-[0.05em] font-[600] ${
            form.customized ? 'text-forth' : 'opacity-50'
          }`}
        >
          {form.customized ? 'Customized' : 'Default'}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
        <Input
          label="Display name"
          name="displayName"
          disableForm={true}
          value={form.displayName}
          onChange={(e) => set('displayName', e.target.value)}
        />
        <Input
          label="Badge (e.g. Most popular)"
          name="badge"
          disableForm={true}
          value={form.badge || ''}
          onChange={(e) => set('badge', e.target.value)}
        />
      </div>

      <Input
        label="Description"
        name="description"
        disableForm={true}
        value={form.description || ''}
        onChange={(e) => set('description', e.target.value)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
        <div>
          <Input
            label={
              currency.inrToUsdRate !== null
                ? `Monthly price (${currency.currencySymbol} INR)`
                : 'Monthly price (USD)'
            }
            name="monthPrice"
            disableForm={true}
            type="number"
            value={toDisplayPrice(form.monthPrice)}
            onChange={(e) => set('monthPrice', fromDisplayPrice(e.target.value))}
          />
          <div className="text-[11px] opacity-60 mt-[4px]">
            {currency.inrToUsdRate !== null
              ? `Stored as $${form.monthPrice.toFixed(2)} USD - converted at ${currency.currencySymbol}${currency.inrToUsdRate}/$1 (Settings -> Payment Gateway)`
              : `Shown as ${monthlyPreview}`}
          </div>
        </div>
        <div>
          <Input
            label={
              currency.inrToUsdRate !== null
                ? `Yearly price (${currency.currencySymbol} INR)`
                : 'Yearly price (USD)'
            }
            name="yearPrice"
            disableForm={true}
            type="number"
            value={toDisplayPrice(form.yearPrice)}
            onChange={(e) => set('yearPrice', fromDisplayPrice(e.target.value))}
          />
          <div className="text-[11px] opacity-60 mt-[4px]">
            {currency.inrToUsdRate !== null
              ? `Stored as $${form.yearPrice.toFixed(2)} USD - converted at ${currency.currencySymbol}${currency.inrToUsdRate}/$1 (Settings -> Payment Gateway)`
              : `Shown as ${yearlyPreview}`}
          </div>
        </div>
      </div>

      <Textarea
        label="Marketing bullet points (one per line)"
        name="features"
        disableForm={true}
        value={featuresText}
        onChange={(e) =>
          set(
            'features',
            e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          )
        }
      />

      <div className="border-t border-newTableBorder pt-[12px]">
        <div className="text-[13px] font-[600] mb-[10px]">Feature limits</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[12px]">
          <Input
            label="Connected channels"
            name="channel"
            disableForm={true}
            type="number"
            value={String(form.channel)}
            onChange={(e) => set('channel', Number(e.target.value) || 0)}
          />
          <Input
            label="Posts per month"
            name="postsPerMonth"
            disableForm={true}
            type="number"
            value={String(form.postsPerMonth)}
            onChange={(e) =>
              set('postsPerMonth', Number(e.target.value) || 0)
            }
          />
          <Input
            label="Webhooks"
            name="webhooks"
            disableForm={true}
            type="number"
            value={String(form.webhooks)}
            onChange={(e) => set('webhooks', Number(e.target.value) || 0)}
          />
          <Input
            label="AI image generations / mo"
            name="imageGenerationCount"
            disableForm={true}
            type="number"
            value={String(form.imageGenerationCount)}
            onChange={(e) =>
              set('imageGenerationCount', Number(e.target.value) || 0)
            }
          />
          <Input
            label="AI video generations / mo"
            name="generateVideos"
            disableForm={true}
            type="number"
            value={String(form.generateVideos)}
            onChange={(e) =>
              set('generateVideos', Number(e.target.value) || 0)
            }
          />
          <Input
            label="YouTube Optimizer AI suggestions / mo"
            name="youtubeTextSuggestions"
            disableForm={true}
            type="number"
            value={String(form.youtubeTextSuggestions)}
            onChange={(e) =>
              set('youtubeTextSuggestions', Number(e.target.value) || 0)
            }
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-[10px] mt-[14px]">
          <Checkbox
            disableForm={true}
            label="Team members"
            checked={form.teamMembers}
            onChange={(e) => set('teamMembers', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Community features"
            checked={form.communityFeatures}
            onChange={(e) => set('communityFeatures', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Featured by Gitroom"
            checked={form.featuredByGitroom}
            onChange={(e) => set('featuredByGitroom', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="AI"
            checked={form.ai}
            onChange={(e) => set('ai', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Import from channels"
            checked={form.importFromChannels}
            onChange={(e) => set('importFromChannels', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Image generator"
            checked={form.imageGenerator}
            onChange={(e) => set('imageGenerator', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Public API"
            checked={form.publicApi}
            onChange={(e) => set('publicApi', e.target.value)}
          />
          <Checkbox
            disableForm={true}
            label="Auto-post"
            checked={form.autoPost}
            onChange={(e) => set('autoPost', e.target.value)}
          />
        </div>
      </div>

      <div className="border-t border-newTableBorder pt-[12px]">
        <div className="flex items-center justify-between gap-[12px] mb-[4px]">
          <div className="text-[13px] font-[600]">RazorPay Plan IDs</div>
          {form.tier !== 'FREE' && (
            <Button
              secondary
              onClick={handleSyncRazorpay}
              loading={syncing}
              className="!h-[28px] !px-[10px] !text-[12px]"
            >
              Sync to RazorPay
            </Button>
          )}
        </div>
        <div className="text-[11px] opacity-60 mb-[10px]">
          RazorPay Plans are immutable once created - leave blank to keep
          using the RAZORPAY_{form.tier}_PLAN_MONTHLY/YEARLY environment
          variables, or paste a freshly-created Plan id here after changing
          the price above. &quot;Sync to RazorPay&quot; creates whichever of
          the two ids below is still blank directly via the RazorPay API
          (using the price above and the INR rate from Settings -&gt; Payment
          Gateway) - it never touches an id that&apos;s already set, so
          it&apos;s always safe to click again.
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[12px]">
          <Input
            label="Monthly Plan ID"
            name="razorpayPlanIdMonthly"
            disableForm={true}
            placeholder="plan_..."
            value={form.razorpayPlanIdMonthly || ''}
            onChange={(e) => set('razorpayPlanIdMonthly', e.target.value)}
          />
          <Input
            label="Yearly Plan ID"
            name="razorpayPlanIdYearly"
            disableForm={true}
            placeholder="plan_..."
            value={form.razorpayPlanIdYearly || ''}
            onChange={(e) => set('razorpayPlanIdYearly', e.target.value)}
          />
        </div>
      </div>

      <div className="border-t border-newTableBorder pt-[12px] flex flex-wrap items-center gap-[20px]">
        <Checkbox
          disableForm={true}
          label="Active"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.value)}
        />
        <Checkbox
          disableForm={true}
          label="Purchasable (shown on /pricing)"
          checked={form.isPurchasable}
          onChange={(e) => set('isPurchasable', e.target.value)}
        />
        <div className="w-[140px]">
          <Input
            label="Sort order"
            name="sortOrder"
            disableForm={true}
            type="number"
            value={String(form.sortOrder)}
            onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
          />
        </div>
      </div>

      <div className="flex gap-[8px]">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        {form.customized && (
          <Button secondary onClick={handleRevert} loading={reverting}>
            Revert to default
          </Button>
        )}
      </div>
    </div>
  );
};

export const AdminPricingPlansComponent: FC = () => {
  const user = useUser();
  const fetch = useFetch();
  const toast = useToaster();
  const { data, isLoading, mutate } = usePricingPlansAdmin();
  const [activeTier, setActiveTier] = useState<string>(TIER_ORDER[0]);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncAll = useCallback(async () => {
    setSyncingAll(true);
    try {
      const res = await fetch(`${PLANS_KEY}/sync-razorpay`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to sync plans with RazorPay');
      }
      const results: { tier: string; ok: boolean; error?: string }[] =
        await res.json();
      await mutate();
      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        toast.show(
          `Synced ${results.length - failed.length}/${results.length} - ` +
            failed.map((f) => `${f.tier}: ${f.error}`).join('; '),
          'warning'
        );
      } else {
        toast.show('All plans are in sync with RazorPay', 'success');
      }
    } catch {
      toast.show('Failed to sync plans with RazorPay', 'warning');
    } finally {
      setSyncingAll(false);
    }
  }, [mutate]);

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  if (isLoading || !data) {
    return <LoadingComponent />;
  }

  const activePlan =
    data.find((p) => p.tier === activeTier) || blankPlanForm(activeTier);

  return (
    <div className="flex flex-col gap-[12px] text-textColor max-w-[820px]">
      <div className="flex items-center justify-between gap-[12px]">
        <div className="text-[20px] font-[600]">Plans & Pricing</div>
        <Button secondary onClick={handleSyncAll} loading={syncingAll}>
          Sync all plans
        </Button>
      </div>
      <div className="text-[13px] opacity-70 max-w-[640px]">
        A fixed set of tiers - price, features, and limits are all editable
        below and take effect immediately (feature-gating, Stripe checkout,
        and the public pricing page all read this table live). Tiers
        themselves can&apos;t be added or removed here since each one is
        wired into permission checks elsewhere in the app by name.
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-newTableBorder">
        {TIER_ORDER.map((tier) => {
          const item = data.find((p) => p.tier === tier);
          const active = tier === activeTier;
          return (
            <button
              key={tier}
              type="button"
              onClick={() => setActiveTier(tier)}
              className={`flex shrink-0 items-center gap-[6px] whitespace-nowrap px-[16px] py-[10px] text-[13px] border-b-2 cursor-pointer ${
                active
                  ? 'border-forth text-textColor font-[600]'
                  : 'border-transparent text-textColor/60'
              }`}
            >
              {TIER_LABELS[tier] || tier}
              {item?.customized && (
                <span className="h-[6px] w-[6px] rounded-full bg-forth" />
              )}
            </button>
          );
        })}
      </div>

      <PricingPlanEditor
        key={activeTier}
        plan={activePlan}
        onReverted={() => void mutate()}
      />
    </div>
  );
};
