'use client';

import React, { FC } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { ADMIN_NAV } from '@gitroom/frontend/components/admin/admin-shell.component';

interface OverviewStats {
  errors: { total: number };
  posts: { total: number };
  connected: { total: number };
}

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);

// Its own hook per CLAUDE.md's SWR rule.
const useAdminOverview = () => {
  const fetch = useFetch();
  const query = new URLSearchParams({
    from: isoDaysAgo(30),
    to: today(),
  });
  return useSWR<OverviewStats>(
    `/admin/stats?${query.toString()}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to load admin overview');
      }
      return res.json();
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );
};

const OverviewCard: FC<{ label: string; value: number }> = ({
  label,
  value,
}) => (
  <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner">
    <div className="text-[12px] opacity-70">{label}</div>
    <div className="text-[28px] font-[600]">{value.toLocaleString()}</div>
  </div>
);

const SECTION_DESCRIPTIONS: Record<string, string> = {
  '/admin/errors': 'Investigate publishing failures across platforms.',
  '/admin/stats': 'Posts, connections and errors over a date range.',
  '/admin/payment-gateway':
    'Choose which gateway new subscriptions use (Stripe or RazorPay).',
  '/admin/mailer':
    'Segment users (subscribers / free / all) for mailer campaigns.',
  '/admin/content': 'Manage blog posts shown on the public site.',
};

const SectionCard: FC<{
  href: string;
  label: string;
  disabled?: boolean;
}> = ({ href, label, disabled }) => {
  const body = (
    <div
      className={`border border-newTableBorder rounded-[8px] p-[16px] h-full flex flex-col gap-[6px] ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : 'bg-newBgColorInner hover:bg-tableBorder cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-[600]">{label}</div>
        {disabled && (
          <span className="text-[10px] uppercase opacity-70">Soon</span>
        )}
      </div>
      <div className="text-[13px] opacity-70">
        {SECTION_DESCRIPTIONS[href] || ''}
      </div>
    </div>
  );

  if (disabled) return body;
  return (
    <Link href={href} className="block">
      {body}
    </Link>
  );
};

export const AdminDashboardComponent: FC = () => {
  const { data, isLoading } = useAdminOverview();

  return (
    <div className="flex flex-col gap-[20px] text-textColor p-[20px]">
      <div className="text-[20px] font-[600]">Admin Dashboard</div>

      {isLoading || !data ? (
        <LoadingComponent />
      ) : (
        <div className="grid grid-cols-3 gap-[12px] max-w-[720px]">
          <OverviewCard label="Errors (30d)" value={data.errors.total} />
          <OverviewCard label="Posts (30d)" value={data.posts.total} />
          <OverviewCard
            label="Connections (30d)"
            value={data.connected.total}
          />
        </div>
      )}

      <div>
        <div className="text-[13px] uppercase opacity-50 mb-[8px]">
          Sections
        </div>
        <div className="grid grid-cols-3 gap-[12px] max-w-[820px]">
          {ADMIN_NAV.filter((item) => item.href !== '/admin/dashboard').map(
            (item) => (
              <SectionCard
                key={item.href}
                href={item.href}
                label={item.label}
                disabled={item.disabled}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};
