'use client';

import React, { FC, useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  errorMessage,
  PromoteCompetitorRow,
  PromotePost,
  usePromoteOverview,
} from '@gitroom/frontend/components/promote/promote.hooks';

const inputClass =
  'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor';

const num = (n: number | null | undefined, digits = 0) =>
  typeof n === 'number'
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : '—';

export const compact = (n: number | null | undefined) =>
  typeof n === 'number'
    ? Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    : '—';

const ago = (iso?: string | null) => {
  if (!iso) return 'never';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

const Sparkline: FC<{ points: (number | null)[] }> = ({ points }) => {
  const vals = points.filter((p): p is number => typeof p === 'number');
  if (vals.length < 2) {
    return (
      <div className="text-[12px] opacity-60">
        Follower history appears here after a couple of daily snapshots.
      </div>
    );
  }
  const w = 220;
  const h = 48;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const d = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 6) - 3;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-[#7c5cff]">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

export const PostTile: FC<{ p: PromotePost }> = ({ p }) => (
  <a
    href={p.permalink}
    target="_blank"
    rel="noreferrer"
    className="flex gap-[10px] items-center bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[8px] w-[260px] hover:opacity-90"
  >
    {p.thumbnailUrl ? (
      <img src={p.thumbnailUrl} className="w-[48px] h-[48px] rounded object-cover" alt="" />
    ) : (
      <div className="w-[48px] h-[48px] rounded bg-white/10" />
    )}
    <div className="min-w-0 flex-1">
      <div className="text-[12px] truncate">{p.caption || '(no caption)'}</div>
      <div className="text-[11px] opacity-70">
        {typeof p.likeCount === 'number' ? `${compact(p.likeCount)} likes` : 'likes hidden'} ·{' '}
        {compact(p.commentsCount)} comments
      </div>
    </div>
  </a>
);

const Avatar: FC<{ src?: string | null; size?: number }> = ({ src, size = 28 }) =>
  src ? (
    <img src={src} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} alt="" />
  ) : (
    <div className="rounded-full bg-white/10" style={{ width: size, height: size }} />
  );

const Th: FC<{ children?: React.ReactNode; right?: boolean }> = ({ children, right = true }) => (
  <th className={`px-[10px] py-[8px] text-[12px] font-[600] opacity-70 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);
const Td: FC<{ children?: React.ReactNode; right?: boolean; className?: string }> = ({
  children,
  right = true,
  className = '',
}) => (
  <td className={`px-[10px] py-[10px] text-[13px] whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>
    {children}
  </td>
);

export const Competitors: FC<{ integrationId: string }> = ({ integrationId }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { mutate } = useSWRConfig();
  const { data, isLoading, error } = usePromoteOverview(integrationId);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const reload = useCallback(
    () => mutate(`promote-overview-${integrationId}`),
    [integrationId, mutate]
  );

  const add = useCallback(async () => {
    const value = username.trim();
    if (!value) return;
    setBusy('add');
    try {
      const res = await fetch(`/promote/${integrationId}/competitors`, {
        method: 'POST',
        body: JSON.stringify({ username: value }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not add this account'), 'warning');
        return;
      }
      setUsername('');
      toaster.show('Competitor added', 'success');
      await reload();
    } finally {
      setBusy(null);
    }
  }, [username, integrationId, fetch, toaster, reload]);

  const refresh = useCallback(
    async (c: PromoteCompetitorRow) => {
      setBusy(c.id);
      try {
        const res = await fetch(`/promote/${integrationId}/competitors/${c.id}/refresh`, {
          method: 'POST',
        });
        if (!res.ok) {
          toaster.show(await errorMessage(res, 'Refresh failed'), 'warning');
        } else {
          toaster.show('Updated', 'success');
        }
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [integrationId, fetch, toaster, reload]
  );

  const remove = useCallback(
    async (c: PromoteCompetitorRow) => {
      if (!(await deleteDialog(`Stop tracking @${c.username}?`, 'Stop tracking'))) {
        return;
      }
      setBusy(c.id);
      try {
        const res = await fetch(`/promote/${integrationId}/competitors/${c.id}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          toaster.show(await errorMessage(res, 'Could not remove'), 'warning');
        }
        await reload();
      } finally {
        setBusy(null);
      }
    },
    [integrationId, fetch, toaster, reload]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-[40px]">
        <LoadingComponent />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-[20px] text-[14px] text-red-400">
        {(error as Error).message}
      </div>
    );
  }

  const self = data?.self;
  const competitors = data?.competitors || [];
  const limit = data?.limit ?? 10;

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap items-center gap-[10px]">
        <input
          className={`${inputClass} w-[260px]`}
          placeholder="Competitor username, e.g. natgeo"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <Button onClick={add} loading={busy === 'add'} disabled={!username.trim() || competitors.length >= limit}>
          Add competitor
        </Button>
        <div className="text-[12px] opacity-60">
          {competitors.length}/{limit} tracked · Business and Creator accounts only · public data via the official Instagram API
        </div>
      </div>

      <div className="overflow-x-auto border border-newTableBorder rounded-[8px]">
        <table className="w-full">
          <thead className="bg-newBgColorInner">
            <tr>
              <Th right={false}>Account</Th>
              <Th>Followers</Th>
              <Th>Growth</Th>
              <Th>Following</Th>
              <Th>Posts</Th>
              <Th>Avg likes</Th>
              <Th>Avg comments</Th>
              <Th>Engagement</Th>
              <Th>Posts / 30d</Th>
              <Th>Updated</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {self && (
              <tr className="border-t border-newTableBorder bg-white/[0.03]">
                <Td right={false}>
                  <div className="flex items-center gap-[8px]">
                    <Avatar src={self.picture} />
                    <div>
                      <div className="font-[600]">@{self.username}</div>
                      <div className="text-[11px] opacity-60">You</div>
                    </div>
                  </div>
                </Td>
                <Td>{num(self.followers)}</Td>
                <Td>—</Td>
                <Td>{num(self.follows)}</Td>
                <Td>{num(self.mediaCount)}</Td>
                <Td>{num(self.avgLikes, 1)}</Td>
                <Td>{num(self.avgComments, 1)}</Td>
                <Td>{self.engagementRate !== null ? `${num(self.engagementRate, 2)}%` : '—'}</Td>
                <Td>{num(self.postsLast30d)}</Td>
                <Td>—</Td>
                <Td />
              </tr>
            )}
            {competitors.map((c) => (
              <React.Fragment key={c.id}>
                <tr
                  className="border-t border-newTableBorder cursor-pointer hover:bg-white/[0.03]"
                  onClick={() => setOpen(open === c.id ? null : c.id)}
                >
                  <Td right={false}>
                    <div className="flex items-center gap-[8px]">
                      <Avatar src={c.picture} />
                      <div>
                        <div className="font-[600]">@{c.username}</div>
                        {c.name && <div className="text-[11px] opacity-60">{c.name}</div>}
                      </div>
                    </div>
                  </Td>
                  <Td>{num(c.followers)}</Td>
                  <Td>
                    {c.growth ? (
                      <span className={c.growth.delta >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {c.growth.delta >= 0 ? '+' : ''}
                        {num(c.growth.delta)} <span className="opacity-60">({c.growth.days}d)</span>
                      </span>
                    ) : (
                      <span className="opacity-50">building…</span>
                    )}
                  </Td>
                  <Td>{num(c.follows)}</Td>
                  <Td>{num(c.mediaCount)}</Td>
                  <Td>{num(c.avgLikes, 1)}</Td>
                  <Td>{num(c.avgComments, 1)}</Td>
                  <Td>{c.engagementRate !== null ? `${num(c.engagementRate, 2)}%` : '—'}</Td>
                  <Td>{num(c.postsLast30d)}</Td>
                  <Td className={c.lastError ? 'text-red-400' : ''}>{ago(c.lastSyncedAt)}</Td>
                  <Td>
                    <div className="flex gap-[8px] justify-end" onClick={(e) => e.stopPropagation()}>
                      <button className="text-[12px] underline disabled:opacity-40" disabled={busy === c.id} onClick={() => refresh(c)}>
                        Refresh
                      </button>
                      <button className="text-[12px] underline text-red-400 disabled:opacity-40" disabled={busy === c.id} onClick={() => remove(c)}>
                        Remove
                      </button>
                    </div>
                  </Td>
                </tr>
                {open === c.id && (
                  <tr className="border-t border-newTableBorder bg-white/[0.02]">
                    <td colSpan={11} className="px-[16px] py-[14px]">
                      <div className="flex flex-col gap-[12px]">
                        {c.lastError && (
                          <div className="text-[12px] text-red-400">Last sync problem: {c.lastError}</div>
                        )}
                        {c.biography && <div className="text-[13px] opacity-80 whitespace-pre-line">{c.biography}</div>}
                        <div className="flex flex-wrap gap-[24px]">
                          <div>
                            <div className="text-[12px] opacity-70 mb-[4px]">Followers (last 90 days)</div>
                            <Sparkline points={c.series.map((s) => s.followers)} />
                          </div>
                          <div>
                            <div className="text-[12px] opacity-70 mb-[4px]">Top recent posts</div>
                            <div className="flex flex-wrap gap-[8px]">
                              {c.topPosts.length ? c.topPosts.map((p) => <PostTile key={p.id} p={p} />) : <span className="text-[12px] opacity-60">No recent posts</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {!competitors.length && (
              <tr className="border-t border-newTableBorder">
                <td colSpan={11} className="px-[16px] py-[28px] text-center text-[13px] opacity-70">
                  No competitors yet. Add a Business or Creator account above to benchmark followers, engagement and posting pace against yours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-[11px] opacity-50">
        Averages use each account's 25 most recent posts. Likes are blank where an account hides them. Engagement = (avg likes + avg comments) ÷ followers.
      </div>
    </div>
  );
};
