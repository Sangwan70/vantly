'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * Auth-aware replacement for the static "Log in" / "Get started free"
 * buttons in the marketing header. The (marketing) route group is
 * deliberately provider-free and `dynamic = 'force-static'` (see this
 * repo's (marketing)/layout.tsx) so it can't read the httpOnly `auth`
 * cookie server-side the way the authenticated (app) layout does - this
 * component instead does a lightweight client-side check against
 * GET /user/self (200 = logged in, 401 = not) once the page has already
 * rendered statically, then swaps the buttons in.
 *
 * Defaults to the logged-out buttons while the check is in flight and on
 * any failure, so the common case (an anonymous visitor) never flashes
 * anything - only a genuinely logged-in visitor sees a brief swap to
 * Dashboard/Logout once the check resolves.
 *
 * Note: in practice a logged-in visitor to `/` is redirected server-side
 * to `/launches` by proxy.ts before this ever renders - this mainly
 * matters on `/pricing`, which proxy.ts deliberately leaves reachable
 * while logged in.
 */
export const MarketingAuthNav = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/user/self`,
          { credentials: 'include', cache: 'no-store' }
        );
        if (!cancelled && res.ok) {
          setIsLoggedIn(true);
        }
      } catch {
        // Network error / backend unreachable - stay on the logged-out
        // buttons rather than guessing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoggedIn) {
    return (
      <>
        <Link
          href="/"
          className="text-[14px] font-[500] text-textColor/80 hover:text-textColor px-[10px] md:px-[12px] py-[8px] transition-colors"
        >
          Dashboard
        </Link>
        <Link
          href="/auth/logout"
          className="text-[14px] font-[600] bg-btnPrimary text-white rounded-[8px] px-[14px] md:px-[16px] py-[10px] hover:opacity-90 transition-opacity"
        >
          Logout
        </Link>
      </>
    );
  }

  return (
    <>
      <Link
        href="/auth/login"
        className="text-[14px] font-[500] text-textColor/80 hover:text-textColor px-[10px] md:px-[12px] py-[8px] transition-colors"
      >
        Log in
      </Link>
      <Link
        href="/auth"
        className="text-[14px] font-[600] bg-btnPrimary text-white rounded-[8px] px-[14px] md:px-[16px] py-[10px] hover:opacity-90 transition-opacity"
      >
        Get started free
      </Link>
    </>
  );
};
