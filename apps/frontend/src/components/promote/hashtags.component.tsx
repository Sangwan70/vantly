'use client';

import React, { FC, useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import {
  errorMessage,
  HashtagResult,
  useHashtagHistory,
  useHashtagQuota,
  useHashtagSets,
} from '@gitroom/frontend/components/promote/promote.hooks';
import {
  compact,
  PostTile,
} from '@gitroom/frontend/components/promote/competitors.component';

const inputClass =
  'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor';

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

const Chip: FC<{ children: React.ReactNode; onClick?: () => void; title?: string; muted?: boolean }> = ({
  children,
  onClick,
  title,
  muted,
}) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`px-[10px] py-[4px] rounded-full text-[12px] border border-newTableBorder ${
      muted ? 'opacity-60' : 'bg-white/5 hover:bg-white/10'
    }`}
  >
    {children}
  </button>
);

const toneByCompetition: Record<string, string> = {
  low: 'bg-green-500/15 text-green-400',
  medium: 'bg-yellow-500/15 text-yellow-300',
  high: 'bg-orange-500/15 text-orange-300',
  'very high': 'bg-red-500/15 text-red-400',
};

const ago = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return hr < 24 ? `${hr}h ago` : `${Math.floor(hr / 24)}d ago`;
};

const toTags = (list: string[]) => list.map((t) => `#${t}`).join(' ');

export const Hashtags: FC<{ integrationId: string }> = ({ integrationId }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { mutate } = useSWRConfig();
  const quota = useHashtagQuota(integrationId);
  const history = useHashtagHistory(integrationId);
  const sets = useHashtagSets();

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<HashtagResult | null>(null);
  const [basket, setBasket] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState<{ tag: string; reason: string; reach: string }[]>([]);
  const [setName, setSetName] = useState('');

  const addToBasket = useCallback((tag: string) => {
    setBasket((b) => (b.includes(tag) || b.length >= 30 ? b : [...b, tag]));
  }, []);

  const research = useCallback(
    async (raw: string, refresh = false) => {
      const hashtag = raw.trim();
      if (!hashtag) return;
      setBusy('research');
      try {
        const res = await fetch(`/promote/hashtags/${integrationId}/research`, {
          method: 'POST',
          body: JSON.stringify({ hashtag, refresh }),
        });
        if (!res.ok) {
          toaster.show(await errorMessage(res, 'Hashtag research failed'), 'warning');
          return;
        }
        const data = (await res.json()) as HashtagResult;
        setResult(data);
        if (data.quotaBlocked) {
          toaster.show('Weekly limit reached, showing the last saved result.', 'warning');
        }
        await Promise.all([
          mutate(`promote-hashtag-quota-${integrationId}`),
          mutate(`promote-hashtag-history-${integrationId}`),
        ]);
      } finally {
        setBusy(null);
      }
    },
    [integrationId, fetch, toaster, mutate]
  );

  const suggest = useCallback(async () => {
    if (topic.trim().length < 3) return;
    setBusy('suggest');
    try {
      const res = await fetch('/promote/hashtags/suggest', {
        method: 'POST',
        body: JSON.stringify({ topic: topic.trim() }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'AI suggestions are not available on your plan'), 'warning');
        return;
      }
      setIdeas((await res.json()).hashtags || []);
    } finally {
      setBusy(null);
    }
  }, [topic, fetch, toaster]);

  const copy = useCallback(
    async (tags: string[]) => {
      try {
        await navigator.clipboard.writeText(toTags(tags));
        toaster.show('Copied', 'success');
      } catch (e) {
        toaster.show('Could not copy', 'warning');
      }
    },
    [toaster]
  );

  const saveSet = useCallback(async () => {
    if (!setName.trim() || !basket.length) return;
    setBusy('save');
    try {
      const res = await fetch('/promote/hashtags/sets', {
        method: 'POST',
        body: JSON.stringify({ name: setName.trim(), hashtags: basket }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not save'), 'warning');
        return;
      }
      setSetName('');
      toaster.show('Saved', 'success');
      await mutate('promote-hashtag-sets');
    } finally {
      setBusy(null);
    }
  }, [setName, basket, fetch, toaster, mutate]);

  const removeSet = useCallback(
    async (id: string, name: string) => {
      if (!(await deleteDialog(`Delete the set "${name}"?`, 'Delete'))) return;
      const res = await fetch(`/promote/hashtags/sets/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not delete'), 'warning');
        return;
      }
      await mutate('promote-hashtag-sets');
    },
    [fetch, toaster, mutate]
  );

  const q = quota.data;
  const used = q?.used ?? 0;
  const limit = q?.limit ?? 30;

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-col gap-[6px]">
        <div className="flex items-center justify-between text-[12px]">
          <span className="opacity-80">
            {used}/{limit} new hashtags used in Instagram's rolling 7-day window
          </span>
          {q?.nextSlotAt && used >= limit && (
            <span className="opacity-70">Next slot {new Date(q.nextSlotAt).toLocaleString()}</span>
          )}
        </div>
        <div className="h-[6px] rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full ${used >= limit ? 'bg-red-400' : used >= limit - 5 ? 'bg-yellow-300' : 'bg-[#7c5cff]'}`}
            style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
          />
        </div>
        <div className="text-[11px] opacity-50">
          Re-opening a hashtag you already researched this week doesn't use another slot. Results are saved for 24 hours.
        </div>
      </div>

      <div className="flex flex-wrap gap-[10px] items-center">
        <input
          className={`${inputClass} w-[260px]`}
          placeholder="Research a hashtag, e.g. skincare"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && research(query)}
        />
        <Button onClick={() => research(query)} loading={busy === 'research'} disabled={!query.trim()}>
          Research
        </Button>
      </div>

      {result && (
        <Card
          title={`#${result.hashtag}`}
          right={
            <div className="flex items-center gap-[10px] text-[12px]">
              <span className="opacity-60">
                {result.cached ? 'Saved result · ' : ''}
                {ago(result.fetchedAt)}
              </span>
              <button className="underline" onClick={() => research(result.hashtag, true)}>
                Refresh
              </button>
              <button className="underline" onClick={() => addToBasket(result.hashtag)}>
                Add to basket
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap gap-[18px] text-[13px]">
            <div>
              <div className="text-[11px] opacity-60">Competition (estimate)</div>
              {result.competition ? (
                <span className={`inline-block px-[8px] py-[2px] rounded-full text-[12px] font-[600] ${toneByCompetition[result.competition]}`}>
                  {result.competition}
                </span>
              ) : (
                '—'
              )}
            </div>
            <div>
              <div className="text-[11px] opacity-60">New posts / hour</div>
              {result.postsPerHour !== null ? result.postsPerHour.toFixed(1) : '—'}
            </div>
            <div>
              <div className="text-[11px] opacity-60">Top posts avg likes</div>
              {result.topStats.avgLikes !== null ? compact(Math.round(result.topStats.avgLikes)) : '—'}
            </div>
            <div>
              <div className="text-[11px] opacity-60">Top posts avg comments</div>
              {result.topStats.avgComments !== null ? compact(Math.round(result.topStats.avgComments)) : '—'}
            </div>
            <div>
              <div className="text-[11px] opacity-60">Top formats</div>
              {result.formats.length
                ? result.formats
                    .slice(0, 3)
                    .map((f) => `${f.type.replace('_', ' ').toLowerCase()} ${Math.round(f.share * 100)}%`)
                    .join(' · ')
                : '—'}
            </div>
          </div>

          {result.related.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <div className="text-[12px] opacity-70">Often used together (click to add to basket)</div>
              <div className="flex flex-wrap gap-[6px]">
                {result.related.map((r) => (
                  <Chip key={r.tag} title={`Seen in ${r.count} sampled posts`} onClick={() => addToBasket(r.tag)}>
                    #{r.tag}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {result.topPosts.length > 0 && (
            <div className="flex flex-col gap-[6px]">
              <div className="text-[12px] opacity-70">Top posts right now</div>
              <div className="flex flex-wrap gap-[8px]">
                {result.topPosts.slice(0, 6).map((p) => (
                  <PostTile key={p.id} p={p} />
                ))}
              </div>
            </div>
          )}
          <div className="text-[11px] opacity-50">
            Competition is estimated from how quickly new posts appear in Instagram's last-24-hours sample. Instagram does not share total post counts or the authors of hashtag posts.
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <Card title={`Basket (${basket.length}/30)`}>
          <div className="flex flex-wrap gap-[6px] min-h-[32px]">
            {basket.length ? (
              basket.map((t) => (
                <Chip key={t} title="Remove" onClick={() => setBasket((b) => b.filter((x) => x !== t))}>
                  #{t} ×
                </Chip>
              ))
            ) : (
              <span className="text-[12px] opacity-60">Add hashtags from research or AI ideas.</span>
            )}
          </div>
          <div className="flex flex-wrap gap-[8px] items-center">
            <Button onClick={() => copy(basket)} disabled={!basket.length} secondary>
              Copy
            </Button>
            <button className="text-[12px] underline" disabled={!basket.length} onClick={() => setBasket([])}>
              Clear
            </button>
            <input
              className={`${inputClass} w-[160px] ml-auto`}
              placeholder="Set name"
              value={setName}
              onChange={(e) => setSetName(e.target.value)}
            />
            <Button onClick={saveSet} loading={busy === 'save'} disabled={!basket.length || !setName.trim()}>
              Save set
            </Button>
          </div>
        </Card>

        <Card title="AI ideas">
          <div className="flex gap-[8px]">
            <input
              className={`${inputClass} flex-1`}
              placeholder="Your niche or post topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && suggest()}
            />
            <Button onClick={suggest} loading={busy === 'suggest'} disabled={topic.trim().length < 3}>
              Suggest
            </Button>
          </div>
          {ideas.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {ideas.map((i) => (
                <span key={i.tag} className="inline-flex items-center gap-[2px]">
                  <Chip title={`${i.reach}: ${i.reason}`} onClick={() => addToBasket(i.tag)}>
                    #{i.tag}
                  </Chip>
                  <button
                    className="text-[11px] underline opacity-70 px-[4px]"
                    title="Research this hashtag with real Instagram data"
                    onClick={() => {
                      setQuery(i.tag);
                      research(i.tag);
                    }}
                  >
                    research
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="text-[11px] opacity-50">
            AI ideas are starting points, not performance data. Research a tag to see how it behaves on Instagram today.
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[16px]">
        <Card title="Saved sets">
          {sets.data?.length ? (
            <div className="flex flex-col gap-[8px]">
              {sets.data.map((s) => (
                <div key={s.id} className="flex flex-col gap-[4px] border-t border-newTableBorder pt-[8px] first:border-0 first:pt-0">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-[600]">{s.name}</span>
                    <span className="flex gap-[10px] text-[12px]">
                      <button className="underline" onClick={() => setBasket(s.hashtags.slice(0, 30))}>
                        Load
                      </button>
                      <button className="underline" onClick={() => copy(s.hashtags)}>
                        Copy
                      </button>
                      <button className="underline text-red-400" onClick={() => removeSet(s.id, s.name)}>
                        Delete
                      </button>
                    </span>
                  </div>
                  <div className="text-[12px] opacity-70 break-words">{toTags(s.hashtags)}</div>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[12px] opacity-60">No saved sets yet.</span>
          )}
        </Card>

        <Card title="Recently researched">
          {history.data?.length ? (
            <div className="flex flex-wrap gap-[6px]">
              {history.data.map((h) => (
                <Chip
                  key={h.hashtag}
                  title={`${h.competition ? `Competition ${h.competition} · ` : ''}${ago(h.fetchedAt)}`}
                  onClick={() => {
                    setQuery(h.hashtag);
                    research(h.hashtag);
                  }}
                >
                  #{h.hashtag}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-[12px] opacity-60">Nothing yet.</span>
          )}
        </Card>
      </div>
    </div>
  );
};
