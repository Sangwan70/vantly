'use client';

import React, { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  errorMessage,
  usePromoteInsights,
} from '@gitroom/frontend/components/promote/promote.hooks';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Show Monday first.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const hourLabel = (h: number) => {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
};

const Card: FC<{ title: string; children: React.ReactNode; right?: React.ReactNode }> = ({
  title,
  children,
  right,
}) => (
  <div className="border border-newTableBorder rounded-[8px] p-[14px] flex flex-col gap-[10px]">
    <div className="flex items-center justify-between gap-[10px]">
      <div className="text-[14px] font-[600]">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

const fmt = (n: number | null | undefined, d = 1) =>
  typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: d }) : '—';

export const Insights: FC<{ integrationId: string }> = ({ integrationId }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading, error } = usePromoteInsights(integrationId);
  const [applying, setApplying] = useState(false);

  const applySlots = useCallback(async () => {
    if (!data?.bestHours.length) return;
    if (
      !(await deleteDialog(
        'This replaces your current daily posting slots for this account with the best hours found here.',
        'Replace slots',
        'Use these times?'
      ))
    ) {
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(`/integrations/${integrationId}/time`, {
        method: 'POST',
        body: JSON.stringify({
          time: data.bestHours.map((h) => ({ time: Math.round(h.hourUtc * 60) })),
        }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not update posting slots'), 'warning');
        return;
      }
      toaster.show('Posting slots updated', 'success');
    } finally {
      setApplying(false);
    }
  }, [data, integrationId, fetch, toaster]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-[40px]">
        <LoadingComponent />
      </div>
    );
  }
  if (error) {
    return <div className="p-[20px] text-[14px] text-red-400">{(error as Error).message}</div>;
  }
  if (!data || data.sampleSize === 0) {
    return (
      <div className="border border-newTableBorder rounded-[8px] p-[24px] text-center text-[14px] opacity-80">
        No posts found on this account yet. Once it has some posts, best times and cadence show up here.
      </div>
    );
  }

  const max = Math.max(
    1,
    ...data.heatmap.flatMap((row) => row.map((v) => (typeof v === 'number' ? v : 0)))
  );
  const maxWeek = Math.max(1, ...data.cadence.weeks.map((w) => w.posts));

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="text-[12px] opacity-60">
        Based on your last {data.sampleSize} posts
        {data.from && data.to
          ? ` (${new Date(data.from).toLocaleDateString()} to ${new Date(data.to).toLocaleDateString()})`
          : ''}
        . Engagement = likes + comments. Times are in your local time zone.
      </div>

      {data.notes.length > 0 && (
        <Card title="What stands out">
          <ul className="list-disc pl-[18px] text-[13px] flex flex-col gap-[4px]">
            {data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <Card
          title="Best hours"
          right={
            data.bestHours.length > 0 && (
              <Button onClick={applySlots} loading={applying} secondary>
                Use as my posting slots
              </Button>
            )
          }
        >
          {data.bestHours.length ? (
            <div className="flex flex-col gap-[6px] text-[13px]">
              {data.bestHours.map((h) => (
                <div key={h.hourLocal} className="flex justify-between">
                  <span className="font-[600]">{hourLabel(h.hourLocal)}</span>
                  <span className="opacity-80">
                    {fmt(h.avgEngagement, 0)} avg
                    {h.lift ? ` · ${h.lift.toFixed(1)}x` : ''} · {h.posts} posts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] opacity-60">Needs at least two posts in the same hour to compare.</span>
          )}
        </Card>

        <Card title="Best days">
          {data.bestDays.length ? (
            <div className="flex flex-col gap-[6px] text-[13px]">
              {data.bestDays.map((d) => (
                <div key={d.day} className="flex justify-between">
                  <span className="font-[600]">{d.name}</span>
                  <span className="opacity-80">
                    {fmt(d.avgEngagement, 0)} avg
                    {d.lift ? ` · ${d.lift.toFixed(1)}x` : ''} · {d.posts} posts
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] opacity-60">Needs at least two posts on the same weekday to compare.</span>
          )}
        </Card>
      </div>

      <Card title="Engagement by day and hour">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid" style={{ gridTemplateColumns: '40px repeat(24, 1fr)' }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[9px] text-center opacity-50">
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
              {DAY_ORDER.map((d) => (
                <React.Fragment key={d}>
                  <div className="text-[11px] opacity-70 pr-[6px] flex items-center">{DAYS[d]}</div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const v = data.heatmap[d][h];
                    const n = data.counts[d][h];
                    return (
                      <div
                        key={h}
                        title={
                          n
                            ? `${DAYS[d]} ${hourLabel(h)}: ${fmt(v, 0)} avg across ${n} post${n > 1 ? 's' : ''}`
                            : `${DAYS[d]} ${hourLabel(h)}: no posts`
                        }
                        className="h-[18px] m-[1px] rounded-[2px] bg-white/5"
                        style={
                          typeof v === 'number'
                            ? { backgroundColor: `rgba(124, 92, 255, ${0.15 + 0.85 * (v / max)})` }
                            : undefined
                        }
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
        <div className="text-[11px] opacity-50">Darker means higher average engagement. Empty cells have no posts, so they are untested rather than bad.</div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <Card title="Format performance">
          <div className="flex flex-col gap-[6px] text-[13px]">
            {data.formats.map((f) => (
              <div key={f.type} className="flex justify-between">
                <span className="font-[600]">{f.type.replace('_', ' ').toLowerCase()}</span>
                <span className="opacity-80">
                  {fmt(f.avgEngagement, 0)} avg
                  {f.lift ? ` · ${f.lift.toFixed(1)}x` : ''} · {f.posts} posts
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Posting cadence"
          right={
            <span className="text-[12px] opacity-70">
              {fmt(data.cadence.avgPerWeek)} posts/week
              {data.cadence.competitorAvgPerWeek !== null ? ` · competitors ${fmt(data.cadence.competitorAvgPerWeek)}` : ''}
            </span>
          }
        >
          <div className="flex items-end gap-[4px] h-[70px]">
            {data.cadence.weeks.map((w, i) => (
              <div
                key={w.weekStart}
                className="flex-1 bg-[#7c5cff]/70 rounded-t-[2px]"
                title={`Week of ${new Date(w.weekStart).toLocaleDateString()}: ${w.posts} posts${
                  i === data.cadence.weeks.length - 1 ? ' (so far)' : ''
                }`}
                style={{ height: `${Math.max(4, (w.posts / maxWeek) * 100)}%` }}
              />
            ))}
          </div>
          <div className="text-[11px] opacity-60">
            Last 12 weeks. Longest gap between posts: {Math.round(data.cadence.longestGapDays)} days.
          </div>
        </Card>
      </div>
    </div>
  );
};
