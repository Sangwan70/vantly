import { ReactNode } from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import clsx from 'clsx';
import { Metadata } from 'next';
import './marketing.scss';

export const dynamic = 'force-static';

// The public marketing pages (`/`, `/pricing`) are a separate root layout
// group, the same officially-supported Next.js "multiple root layouts"
// pattern already used by (app), (extension) and (provider) in this repo.
// It intentionally does NOT reuse (app)/layout.tsx: no auth cookie context,
// no translation/context providers, no analytics/Sentry/PostHog wiring -
// just fonts + Tailwind, so these pages stay fast and fully public.
const jakartaSans = Plus_Jakarta_Sans({
  weight: ['500', '600', '700', '800'],
  style: ['normal'],
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Vantly - Schedule and grow every social channel from one place',
  description:
    'Vantly is the social media scheduling and AI content platform for YouTube, X, LinkedIn, Instagram, TikTok, Facebook, and more - plus an AI YouTube Optimizer that finds and fixes what is holding your videos back.',
};

export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body
        className={clsx(
          jakartaSans.className,
          'dark text-textColor !bg-primary'
        )}
      >
        {children}
      </body>
    </html>
  );
}
