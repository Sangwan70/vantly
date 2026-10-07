'use client';

import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export interface PromoteAccount {
  id: string;
  name: string;
  picture?: string | null;
  providerIdentifier: string;
  eligible: boolean;
  reason: string | null;
}

export interface PromotePost {
  id: string;
  caption?: string;
  mediaType?: string;
  permalink?: string;
  thumbnailUrl?: string;
  timestamp?: string;
  likeCount?: number;
  commentsCount?: number;
}

export interface PromoteStats {
  followers: number | null;
  follows: number | null;
  mediaCount: number | null;
  avgLikes: number | null;
  avgComments: number | null;
  postsLast30d: number;
  engagementRate: number | null;
  topPosts: PromotePost[];
}

export interface PromoteSelf extends PromoteStats {
  username: string;
  name?: string;
  picture?: string;
}

export interface PromoteCompetitorRow extends PromoteStats {
  id: string;
  username: string;
  name?: string | null;
  picture?: string | null;
  biography?: string | null;
  growth: { delta: number; days: number } | null;
  series: { date: string; followers: number | null }[];
  lastSyncedAt: string | null;
  lastError: string | null;
}

export interface PromoteOverview {
  limit: number;
  self: PromoteSelf | null;
  competitors: PromoteCompetitorRow[];
}

// Reads { message } from a failed Nest response, with a fallback.
export const errorMessage = async (res: Response, fallback: string) => {
  try {
    const json = await res.json();
    const m = json?.message;
    return (Array.isArray(m) ? m.join(', ') : m) || fallback;
  } catch (e) {
    return fallback;
  }
};

export const usePromoteAccounts = () => {
  const fetch = useFetch();
  return useSWR<PromoteAccount[]>(
    'promote-accounts',
    async () => {
      const res = await fetch('/promote/accounts');
      if (!res.ok) throw new Error('Failed to load accounts');
      return res.json();
    },
    { revalidateOnFocus: false }
  );
};

export const usePromoteOverview = (integrationId?: string) => {
  const fetch = useFetch();
  return useSWR<PromoteOverview>(
    integrationId ? `promote-overview-${integrationId}` : null,
    async () => {
      const res = await fetch(`/promote/${integrationId}/competitors`);
      if (!res.ok) {
        throw new Error(await errorMessage(res, 'Failed to load competitors'));
      }
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};
