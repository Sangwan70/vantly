import { SentryComponent } from '@gitroom/frontend/components/layout/sentry.component';

export const dynamic = 'force-dynamic';
import '../global.scss';
import 'react-tooltip/dist/react-tooltip.css';
import '@copilotkit/react-ui/styles.css';
import LayoutContext from '@gitroom/frontend/components/layout/layout.context';
import { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import PlausibleProvider from 'next-plausible';
import clsx from 'clsx';
import { VariableContextComponent } from '@gitroom/react/helpers/variable.context';
import { Fragment } from 'react';
import { PHProvider } from '@gitroom/react/helpers/posthog';
import UtmSaver from '@gitroom/helpers/utils/utm.saver';
import { DubAnalytics } from '@gitroom/frontend/components/layout/dubAnalytics';
import { FacebookComponent } from '@gitroom/frontend/components/layout/facebook.component';
import { GoogleTagManagerComponent } from '@gitroom/frontend/components/layout/gtm.component';
import { cookies } from 'next/headers';
import {
  cookieName,
  fallbackLng,
} from '@gitroom/react/translation/i18n.config';
import { HtmlComponent } from '@gitroom/frontend/components/layout/html.component';
import Script from 'next/script';
import { ChangeDirClient } from '@gitroom/frontend/components/new-layout/change.dir.client';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

interface BillingConfig {
  activeGateway: 'stripe' | 'razorpay';
  currencySymbol: string;
  inrToUsdRate: number | null;
  razorpayKeyId: string;
  billingEnabled: boolean;
}

// Everything this layout needs to render checkout UI/prices for whichever
// gateway is actually active, resolved the same way the backend resolves
// it (Settings -> Payment Gateway admin override, DB-first, else env vars,
// else razorpay/USD) - see payment-gateway-settings.service.ts's
// resolvePublicBillingConfig(). Reading process.env.PAYMENT_GATEWAY /
// RAZORPAY_API_KEY directly here would ignore any admin override made
// through the Admin Panel (a DB-only RazorPay key with no env var set, for
// instance), since this app has no direct DB access of its own - it only
// talks to the backend over HTTP. Falls back to the same env-var-driven
// defaults if the backend call itself fails, so a slow/unreachable backend
// degrades to "best guess" rather than breaking the whole page.
async function resolveBillingConfig(): Promise<BillingConfig> {
  const fallbackGateway = process.env.PAYMENT_GATEWAY === 'stripe' ? 'stripe' : 'razorpay';
  const fallback: BillingConfig = {
    activeGateway: fallbackGateway,
    currencySymbol: fallbackGateway === 'razorpay' ? '\u20b9' : '$',
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

export default async function AppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const language = cookieStore.get(cookieName)?.value || fallbackLng;
  const billingConfig = await resolveBillingConfig();
  const Plausible = !!process.env.STRIPE_PUBLISHABLE_KEY
    ? PlausibleProvider
    : Fragment;
  return (
    <html>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        {!!process.env.DATAFAST_WEBSITE_ID && (
          <Script
            data-website-id={process.env.DATAFAST_WEBSITE_ID}
            data-domain="vantly.social"
            src="https://datafa.st/js/script.js"
            strategy="afterInteractive"
          />
        )}
      </head>
      <ChangeDirClient />
      <body
        className={clsx(jakartaSans.className, 'dark text-primary !bg-primary')}
      >
        <VariableContextComponent
          storageProvider={
            process.env.STORAGE_PROVIDER! as 'local' | 'cloudflare'
          }
          environment={process.env.NODE_ENV!}
          backendUrl={process.env.NEXT_PUBLIC_BACKEND_URL!}
          plontoKey={process.env.NEXT_PUBLIC_POLOTNO!}
          stripeClient={process.env.STRIPE_PUBLISHABLE_KEY!}
          isChatBase={!!process.env.CHATBASE_TOKEN}
          paymentGateway={billingConfig.activeGateway}
          razorpayKeyId={billingConfig.razorpayKeyId}
          billingEnabled={billingConfig.billingEnabled}
          currencySymbol={billingConfig.currencySymbol}
          inrToUsdRate={billingConfig.inrToUsdRate}
          discordUrl={process.env.NEXT_PUBLIC_DISCORD_SUPPORT!}
          frontEndUrl={process.env.FRONTEND_URL!}
          isGeneral={!!process.env.IS_GENERAL}
          genericOauth={!!process.env.POSTIZ_GENERIC_OAUTH}
          oauthLogoUrl={process.env.NEXT_PUBLIC_POSTIZ_OAUTH_LOGO_URL!}
          oauthDisplayName={process.env.NEXT_PUBLIC_POSTIZ_OAUTH_DISPLAY_NAME!}
          uploadDirectory={process.env.NEXT_PUBLIC_UPLOAD_STATIC_DIRECTORY!}
          cloudflareUrl={process.env.CLOUDFLARE_BUCKET_URL || ''}
          mainUrl={process.env.MAIN_URL || ''}
          mcpUrl={process.env.MCP_URL}
          dub={!!process.env.STRIPE_PUBLISHABLE_KEY}
          facebookPixel={process.env.NEXT_PUBLIC_FACEBOOK_PIXEL!}
          telegramBotName={process.env.TELEGRAM_BOT_NAME!}
          neynarClientId={process.env.NEYNAR_CLIENT_ID!}
          isSecured={!process.env.NOT_SECURED}
          disableImageCompression={!!process.env.DISABLE_IMAGE_COMPRESSION}
          disableXAnalytics={!!process.env.DISABLE_X_ANALYTICS}
          sentryDsn={process.env.NEXT_PUBLIC_SENTRY_DSN!}
          extensionId={process.env.EXTENSION_ID || ''}
          googleAdsId={process.env.NEXT_PUBLIC_GTM_ID}
          googleAdsTrialTracking={process.env.NEXT_PUBLIC_TRACKING_TRIAL}
          language={language}
          transloadit={
            process.env.TRANSLOADIT_AUTH && process.env.TRANSLOADIT_TEMPLATE
              ? [
                  process.env.TRANSLOADIT_AUTH!,
                  process.env.TRANSLOADIT_TEMPLATE!,
                ]
              : []
          }
        >
          <SentryComponent>
            {/*<SetTimezone />*/}
            <HtmlComponent />
            <DubAnalytics />
            <FacebookComponent />
            <GoogleTagManagerComponent gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
            <Plausible
              domain={!!process.env.IS_GENERAL ? 'vantly.social' : 'gitroom.com'}
            >
              <PHProvider
                phkey={process.env.NEXT_PUBLIC_POSTHOG_KEY}
                host={process.env.NEXT_PUBLIC_POSTHOG_HOST}
              >
                <LayoutContext>
                  <UtmSaver />
                  {children}
                </LayoutContext>
              </PHProvider>
            </Plausible>
          </SentryComponent>
        </VariableContextComponent>
      </body>
    </html>
  );
}
