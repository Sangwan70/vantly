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

export interface HashtagQuota {
  used: number;
  limit: number;
  nextSlotAt: string | null;
}

export interface HashtagResult {
  hashtag: string;
  topStats: { avgLikes: number | null; avgComments: number | null };
  postsPerHour: number | null;
  competition: 'low' | 'medium' | 'high' | 'very high' | null;
  formats: { type: string; share: number }[];
  related: { tag: string; count: number }[];
  topPosts: PromotePost[];
  recentPosts: PromotePost[];
  fetchedAt: string;
  cached?: boolean;
  quotaBlocked?: boolean;
  quota?: HashtagQuota;
}

export interface HashtagHistoryRow {
  hashtag: string;
  fetchedAt: string;
  competition: HashtagResult['competition'];
  avgLikes: number | null;
  inWindow: boolean;
}

export interface HashtagSet {
  id: string;
  name: string;
  hashtags: string[];
  createdAt: string;
}

export const useHashtagQuota = (integrationId: string) => {
  const fetch = useFetch();
  return useSWR<HashtagQuota>(
    `promote-hashtag-quota-${integrationId}`,
    async () => {
      const res = await fetch(`/promote/hashtags/${integrationId}/quota`);
      if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load quota'));
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};

export const useHashtagHistory = (integrationId: string) => {
  const fetch = useFetch();
  return useSWR<HashtagHistoryRow[]>(
    `promote-hashtag-history-${integrationId}`,
    async () => {
      const res = await fetch(`/promote/hashtags/${integrationId}/history`);
      if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load history'));
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};

export const useHashtagSets = () => {
  const fetch = useFetch();
  return useSWR<HashtagSet[]>(
    'promote-hashtag-sets',
    async () => {
      const res = await fetch('/promote/hashtags/sets');
      if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load sets'));
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};

export interface InsightsResult {
  sampleSize: number;
  withEngagement: number;
  enough: boolean;
  from: string | null;
  to: string | null;
  avgEngagement: number | null;
  heatmap: (number | null)[][];
  counts: number[][];
  bestHours: {
    hourLocal: number;
    hourUtc: number;
    avgEngagement: number;
    lift: number | null;
    posts: number;
  }[];
  bestDays: {
    day: number;
    name: string;
    avgEngagement: number;
    lift: number | null;
    posts: number;
  }[];
  formats: { type: string; posts: number; avgEngagement: number; lift: number | null }[];
  cadence: {
    weeks: { weekStart: string; posts: number; avgEngagement: number | null }[];
    avgPerWeek: number;
    longestGapDays: number;
    competitorAvgPerWeek: number | null;
    competitors: { username: string; perWeek: number }[];
  };
  notes: string[];
}

export const usePromoteInsights = (integrationId: string) => {
  const fetch = useFetch();
  return useSWR<InsightsResult>(
    `promote-insights-${integrationId}`,
    async () => {
      const offset = -new Date().getTimezoneOffset();
      const res = await fetch(`/promote/${integrationId}/insights?offset=${offset}`);
      if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load insights'));
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};

export interface InboxComment {
  id: string;
  text: string;
  username: string;
  timestamp?: string;
  likeCount: number;
  replies: { id: string; text: string; username: string; timestamp?: string }[];
  own: boolean;
  replied: boolean;
  needsReply: boolean;
}

export interface InboxPost {
  media: PromotePost;
  comments: InboxComment[];
}

export interface CommentInbox {
  unanswered: number;
  posts: InboxPost[];
}

export const usePromoteComments = (integrationId: string) => {
  const fetch = useFetch();
  return useSWR<CommentInbox>(
    `promote-comments-${integrationId}`,
    async () => {
      const res = await fetch(`/promote/comments/${integrationId}`);
      if (!res.ok) throw new Error(await errorMessage(res, 'Failed to load comments'));
      return res.json();
    },
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );
};
