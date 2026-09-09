'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Select } from '@gitroom/react/form/select';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

type CredentialSource = 'database' | 'env' | 'none';

interface PaymentGatewaySettingsResponse {
  activeGateway: 'stripe' | 'razorpay';
  isOverridden: boolean;
  stripe: { set: boolean; source: CredentialSource };
  razorpay: { set: boolean; source: CredentialSource };
  currency: { inrToUsdRate: number; isDefault: boolean };
}

const SETTINGS_KEY = '/admin/settings/payment-gateway';

// Its own hook per CLAUDE.md's SWR rule - one useSWR call per hook, no
// wrapping multiple calls behind a single hook.
const usePaymentGatewaySettings = () => {
  const fetch = useFetch();
  return useSWR<PaymentGatewaySettingsResponse>(
    SETTINGS_KEY,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load payment gateway settings');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

const sourceLabel = (source: CredentialSource) => {
  switch (source) {
    case 'database':
      return 'Using the key saved here in the Admin Panel.';
    case 'env':
      return 'Using the environment variable set at deploy time.';
    default:
      return 'Not configured - this gateway cannot be used until a key is set.';
  }
};

const SourceBadge: FC<{ source: CredentialSource }> = ({ source }) => {
  const label =
    source === 'database'
      ? 'From database'
      : source === 'env'
      ? 'From environment'
      : 'Not configured';
  return (
    <div
      className={`text-[11px] uppercase tracking-[0.05em] font-[600] ${
        source === 'database'
          ? 'text-forth'
          : source === 'env'
          ? 'opacity-60'
          : 'text-red-400'
      }`}
    >
      {label}
    </div>
  );
};

// Mirrors vantly-ugc.com's Settings -> Payment Gateways admin surface:
// an active-gateway selector plus one card per gateway with a DB/env/none
// credential-source indicator and a secret that never round-trips back to
// the browser once saved (GET only ever returns a `set`/`source` flag -
// see PaymentGatewaySettingsService.getPublicSettings). PayPal is
// intentionally not ported here - there is no PayPal integration in this
// codebase to configure credentials for. The per-gateway Plans/pricing
// table from the reference lives on its own admin screen instead (Admin
// Panel -> Plans & Pricing, admin-pricing-plans.component.tsx) rather than
// as a tab here, matching every other admin section's one-route-per-area
// convention (see admin-shell.component.tsx's ADMIN_NAV).
export const AdminPaymentGatewayComponent: FC = () => {
  const user = useUser();
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const { data, isLoading } = usePaymentGatewaySettings();

  const [pendingGateway, setPendingGateway] = useState<
    'stripe' | 'razorpay' | null
  >(null);
  const [savingGateway, setSavingGateway] = useState(false);

  const [stripeKey, setStripeKey] = useState('');
  const [savingStripe, setSavingStripe] = useState(false);

  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [savingRazorpay, setSavingRazorpay] = useState(false);

  const [inrRateInput, setInrRateInput] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);

  const putSettings = useCallback(
    async (body: Record<string, unknown>) => {
      await fetch(SETTINGS_KEY, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      await mutate(SETTINGS_KEY);
    },
    [fetch, mutate]
  );

  const handleSaveGateway = useCallback(async () => {
    if (!pendingGateway) return;
    setSavingGateway(true);
    try {
      await putSettings({ activeGateway: pendingGateway });
      toast.show('Active gateway updated', 'success');
      setPendingGateway(null);
    } catch {
      toast.show('Failed to update active gateway', 'warning');
    } finally {
      setSavingGateway(false);
    }
  }, [pendingGateway, putSettings, toast]);

  const handleSaveStripe = useCallback(async () => {
    if (!stripeKey.trim()) return;
    setSavingStripe(true);
    try {
      await putSettings({ stripeSecretKey: stripeKey.trim() });
      toast.show('Stripe secret key saved', 'success');
      setStripeKey('');
    } catch {
      toast.show('Failed to save the Stripe secret key', 'warning');
    } finally {
      setSavingStripe(false);
    }
  }, [stripeKey, putSettings, toast]);

  const handleClearStripe = useCallback(async () => {
    if (
      !window.confirm(
        'Remove the saved Stripe secret key? Stripe will fall back to the STRIPE_SECRET_KEY environment variable, if one is set.'
      )
    ) {
      return;
    }
    setSavingStripe(true);
    try {
      await putSettings({ clearStripeSecretKey: true });
      toast.show('Stripe secret key removed', 'success');
    } catch {
      toast.show('Failed to remove the Stripe secret key', 'warning');
    } finally {
      setSavingStripe(false);
    }
  }, [putSettings, toast]);

  const handleSaveRazorpay = useCallback(async () => {
    if (!razorpayKeyId.trim() || !razorpayKeySecret.trim()) return;
    setSavingRazorpay(true);
    try {
      await putSettings({
        razorpayKeyId: razorpayKeyId.trim(),
        razorpayKeySecret: razorpayKeySecret.trim(),
      });
      toast.show('RazorPay credentials saved', 'success');
      setRazorpayKeyId('');
      setRazorpayKeySecret('');
    } catch {
      toast.show('Failed to save RazorPay credentials', 'warning');
    } finally {
      setSavingRazorpay(false);
    }
  }, [razorpayKeyId, razorpayKeySecret, putSettings, toast]);

  const handleClearRazorpay = useCallback(async () => {
    if (
      !window.confirm(
        'Remove the saved RazorPay key id/secret? RazorPay will fall back to the RAZORPAY_API_KEY/RAZORPAY_API_SECRET environment variables, if set.'
      )
    ) {
      return;
    }
    setSavingRazorpay(true);
    try {
      await putSettings({ clearRazorpayCredentials: true });
      toast.show('RazorPay credentials removed', 'success');
    } catch {
      toast.show('Failed to remove RazorPay credentials', 'warning');
    } finally {
      setSavingRazorpay(false);
    }
  }, [putSettings, toast]);

  const handleSaveInrRate = useCallback(async () => {
    const parsed = Number(inrRateInput);
    if (!inrRateInput.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    setSavingCurrency(true);
    try {
      await putSettings({ inrToUsdRate: parsed });
      toast.show('INR display rate saved', 'success');
      setInrRateInput('');
    } catch {
      toast.show('Failed to save the INR display rate', 'warning');
    } finally {
      setSavingCurrency(false);
    }
  }, [inrRateInput, putSettings, toast]);

  const handleResetInrRate = useCallback(async () => {
    setSavingCurrency(true);
    try {
      await putSettings({ inrToUsdRate: null });
      toast.show('INR display rate reset to default', 'success');
      setInrRateInput('');
    } catch {
      toast.show('Failed to reset the INR display rate', 'warning');
    } finally {
      setSavingCurrency(false);
    }
  }, [putSettings, toast]);

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

  const selectedGateway = pendingGateway ?? data.activeGateway;

  return (
    <div className="flex flex-col gap-[16px] text-textColor max-w-[560px]">
      <div className="text-[20px] font-[600]">Payment Gateways</div>
      <div className="text-[13px] opacity-70">
        Choose which gateway new subscriptions go through, and the
        credentials each gateway uses. Existing subscribers keep being
        billed through whichever gateway they actually subscribed with,
        regardless of these settings.
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
        <div className="text-[15px] font-[600]">Active gateway</div>
        <Select
          label="Active gateway"
          name="activeGateway"
          disableForm={true}
          value={selectedGateway}
          onChange={(e) =>
            setPendingGateway(e.target.value as 'stripe' | 'razorpay')
          }
        >
          <option value="razorpay">RazorPay</option>
          <option value="stripe">Stripe</option>
        </Select>

        <div className="text-[12px] opacity-70">
          {data.isOverridden
            ? 'Currently set explicitly through this Admin Panel.'
            : 'Currently following the PAYMENT_GATEWAY environment variable (or RazorPay, the default, if unset).'}
        </div>

        <div>
          <Button
            onClick={handleSaveGateway}
            loading={savingGateway}
            disabled={!pendingGateway || pendingGateway === data.activeGateway}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-[600]">Stripe</div>
          <SourceBadge source={data.stripe.source} />
        </div>
        <div className="text-[12px] opacity-70">
          {sourceLabel(data.stripe.source)}
        </div>

        <Input
          label="Secret key"
          name="stripeSecretKey"
          disableForm={true}
          type="password"
          autoComplete="off"
          placeholder={data.stripe.set ? '••••••••••••••••••' : 'sk_live_...'}
          value={stripeKey}
          onChange={(e) => setStripeKey(e.target.value)}
        />

        <div className="flex gap-[8px]">
          <Button
            onClick={handleSaveStripe}
            loading={savingStripe}
            disabled={!stripeKey.trim()}
          >
            Save
          </Button>
          {data.stripe.source === 'database' && (
            <Button secondary onClick={handleClearStripe} loading={savingStripe}>
              Clear saved key
            </Button>
          )}
        </div>
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
        <div className="flex items-center justify-between">
          <div className="text-[15px] font-[600]">RazorPay</div>
          <SourceBadge source={data.razorpay.source} />
        </div>
        <div className="text-[12px] opacity-70">
          {sourceLabel(data.razorpay.source)}
        </div>

        <Input
          label="Key ID"
          name="razorpayKeyId"
          disableForm={true}
          autoComplete="off"
          placeholder={data.razorpay.set ? 'rzp_live_••••••••' : 'rzp_live_...'}
          value={razorpayKeyId}
          onChange={(e) => setRazorpayKeyId(e.target.value)}
        />
        <Input
          label="Key secret"
          name="razorpayKeySecret"
          disableForm={true}
          type="password"
          autoComplete="off"
          placeholder={data.razorpay.set ? '••••••••••••••••••' : 'your RazorPay key secret'}
          value={razorpayKeySecret}
          onChange={(e) => setRazorpayKeySecret(e.target.value)}
        />

        <div className="flex gap-[8px]">
          <Button
            onClick={handleSaveRazorpay}
            loading={savingRazorpay}
            disabled={!razorpayKeyId.trim() || !razorpayKeySecret.trim()}
          >
            Save
          </Button>
          {data.razorpay.source === 'database' && (
            <Button
              secondary
              onClick={handleClearRazorpay}
              loading={savingRazorpay}
            >
              Clear saved credentials
            </Button>
          )}
        </div>
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[12px]">
        <div className="text-[15px] font-[600]">RazorPay display currency</div>
        <div className="text-[12px] opacity-70">
          Vantly always shows USD prices when Stripe is active. When
          RazorPay is active, prices are shown converted to INR at this
          rate - purely a display estimate: the amount RazorPay actually
          charges is fixed by whatever Plan was configured on RazorPay's
          side (RAZORPAY_*_PLAN_MONTHLY/YEARLY), independent of this rate.
        </div>
        <div className="text-[12px] opacity-70">
          Currently: 1 USD = {'₹'}
          {data.currency.inrToUsdRate}{' '}
          {data.currency.isDefault ? '(default)' : '(set here in the Admin Panel)'}
        </div>

        <Input
          label="1 USD in INR"
          name="inrToUsdRate"
          disableForm={true}
          type="number"
          autoComplete="off"
          placeholder={String(data.currency.inrToUsdRate)}
          value={inrRateInput}
          onChange={(e) => setInrRateInput(e.target.value)}
        />

        <div className="flex gap-[8px]">
          <Button
            onClick={handleSaveInrRate}
            loading={savingCurrency}
            disabled={!inrRateInput.trim()}
          >
            Save
          </Button>
          {!data.currency.isDefault && (
            <Button secondary onClick={handleResetInrRate} loading={savingCurrency}>
              Reset to default
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
