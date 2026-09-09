'use client';

import React, { FC, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@gitroom/frontend/components/layout/user.context';

interface AdminNavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

// Central list of everything that lives under /admin - add a new section
// here (and its own route folder) rather than another one-off button in
// the global impersonate toolbar. Items marked disabled are sections that
// are planned but not built yet, shown so the nav communicates the full
// shape of the Admin area up front instead of appearing piecemeal.
export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/errors', label: 'Errors' },
  { href: '/admin/stats', label: 'Stats' },
  { href: '/admin/payment-gateway', label: 'Payment Gateway' },
  { href: '/admin/pricing-plans', label: 'Plans & Pricing' },
  { href: '/admin/mailer', label: 'Mailer' },
  { href: '/admin/content', label: 'Content' },
  { href: '/admin/tools', label: 'Tools' },
];

const AdminNavLink: FC<{ item: AdminNavItem; active: boolean }> = ({
  item,
  active,
}) => {
  if (item.disabled) {
    return (
      <div className="px-[12px] py-[8px] rounded-[8px] text-[14px] opacity-40 cursor-not-allowed whitespace-nowrap">
        {item.label}
        <span className="ml-[6px] text-[10px] uppercase opacity-70">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={`px-[12px] py-[8px] rounded-[8px] text-[14px] whitespace-nowrap ${
        active
          ? 'bg-forth text-white'
          : 'text-textColor hover:bg-newTableBorder'
      }`}
    >
      {item.label}
    </Link>
  );
};

export const AdminShellComponent: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const user = useUser();
  const pathname = usePathname();

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      <div className="w-[220px] shrink-0 border-r border-newTableBorder p-[16px] flex flex-col gap-[4px]">
        <div className="text-[12px] uppercase opacity-50 px-[12px] pb-[8px]">
          Admin
        </div>
        {ADMIN_NAV.map((item) => (
          <AdminNavLink
            key={item.href}
            item={item}
            active={pathname === item.href}
          />
        ))}
      </div>
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
};
