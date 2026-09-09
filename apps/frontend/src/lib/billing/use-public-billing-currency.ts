'use client';

import { useEffect, useState } from 'react';
import type { CurrencyDisplayContext } from '@gitroom/frontend/lib/billing/currency-display';

const USD_DEFAULT: CurrencyDisplayContext = {
  currencySymbol: '$',
  inrToUsdRate: null,
};

/**
 * (marketing) is a deliberately provider-free root layout (force-static,
 * no VariableContext - see its own doc comment), so pages/components under
 * it can't read currency off useVariables() the way authenticated (app)
 * pages do. This calls the backend's public endpoint directly with the
 * same NEXT_PUBLIC_BACKEND_URL every other (marketing) client component
 * resolves through (see blog-grid.tsx), and starts from the USD default so
 * the static-rendered HTML shows a sane price before this fetch resolves -
 * it only ever upgrades the display (e.g. to INR), never blocks it.
 */
export function usePublicBillingCurrency(): CurrencyDisplayContext {
  const [ctx, setCtx] = useState<CurrencyDisplayContext>(USD_DEFAULT);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/public/billing/active-gateway`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          currencySymbol?: string;
          inrToUsdRate?: number | null;
        };
        if (!cancelled && data.currencySymbol) {
          setCtx({
            currencySymbol: data.currencySymbol,
            inrToUsdRate: data.inrToUsdRate ?? null,
          });
        }
      } catch {
        // Keep the USD default - a failed fetch here must never break the
        // pricing page, only leave it showing plain USD.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return ctx;
}
