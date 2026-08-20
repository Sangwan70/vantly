'use client';

import useSWR from 'swr';
import { useCallback, useEffect, useRef } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useYoutubeChannels } from '@gitroom/frontend/components/youtube-optimizer/youtube.channels.hook';
import { ChannelSwitcher } from '@gitroom/frontend/components/youtube-optimizer/channel-switcher';
import {
  FeedCard,
  FeedInsight,
} from '@gitroom/frontend/components/youtube-optimizer/feed.card';
import { formatCount } from '@gitroom/frontend/components/youtube-optimizer/video.optimizer.modal';

// Optimizer Phase 7: Feed is its own page now, separate from Optimize (the
// video library + per-video editor) - this is the proactive, "the system
// found something and is telling you" surface (vidIQ's own Feed/Optimize
// split), so it needs its own place in the nav rather than living as a
// section partway down the video-library page.
type ChannelOverview = {
  subscriberCount: number;
  subscriberMilestone: number;
  subscriberProgress: number;
  viewCount: number;
  viewMilestone: number;
  viewProgress: number;
  videoCount: number;
};

export const YoutubeFeed = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { channels, isLoadingChannels, current, setCurrent, currentChannel } =
    useYoutubeChannels();

  const loadOverview = useCallback(async () => {
    if (!currentChannel) return undefined;
    return (await (
      await fetch(`/youtube-optimizer/${currentChannel.id}/overview`)
    ).json()) as ChannelOverview | undefined;
  }, [currentChannel]);

  const { data: overview } = useSWR(
    currentChannel ? `optimize-youtube-overview-${currentChannel.id}` : null,
    loadOverview,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
    }
  );

  const loadInsights = useCallback(async () => {
    if (!currentChannel) return [] as FeedInsight[];
    return (await (
      await fetch(`/youtube-optimizer/${currentChannel.id}/insights`)
    ).json()) as FeedInsight[];
  }, [currentChannel]);

  const { data: insights, mutate: mutateInsights } = useSWR(
    currentChannel ? `optimize-youtube-insights-${currentChannel.id}` : null,
    loadInsights,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      fallbackData: [],
    }
  );

  const dismissInsight = useCallback(
    async (insightId: string) => {
      if (!currentChannel) return;
      // Optimistic - the card should disappear immediately rather than
      // waiting on a round-trip, same as the vidIQ reference UI's X button.
      mutateInsights(
        (current) => (current || []).filter((card) => card.id !== insightId),
        { revalidate: false }
      );
      try {
        await fetch(
          `/youtube-optimizer/${currentChannel.id}/insights/${encodeURIComponent(
            insightId
          )}/dismiss`,
          { method: 'POST' }
        );
      } catch (e) {
        // Best-effort - if the dismiss call fails the card may reappear on
        // the next load, which is an acceptable degradation rather than
        // blocking the UI on a retry.
      }
    },
    [currentChannel, fetch, mutateInsights]
  );

  // A Feed card just applied, regenerated, or replied - the underlying cache
  // it was rendered from is now stale (applying clears it server-side,
  // regenerating replaces it), so pull a fresh feed rather than trying to
  // patch the card's data in place.
  const refreshInsights = useCallback(() => {
    mutateInsights();
  }, [mutateInsights]);

  // Optimizer Phase 7: fire once per channel per page-load (a ref, not
  // state, so it doesn't itself trigger a re-render) so a first-time or
  // returning visitor sees real cards here without ever touching Optimize -
  // the server-side gate (see autoPopulateFeed) is what actually limits this
  // to once a day per channel; this effect just calls it every time Feed
  // mounts for a channel and lets the backend decide whether that's a no-op.
  // Best-effort throughout - if this fails, Feed just shows whatever was
  // already cached, same as before this existed.
  const autoPopulateTriggered = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentChannel || autoPopulateTriggered.current.has(currentChannel.id)) {
      return;
    }
    autoPopulateTriggered.current.add(currentChannel.id);

    (async () => {
      try {
        const response = await fetch(
          `/youtube-optimizer/${currentChannel.id}/auto-populate`,
          { method: 'POST' }
        );
        if (response.ok) {
          const data = await response.json();
          if (data?.triggered) {
            // New suggestions just landed in cache - pull a fresh feed so
            // they show up without the user needing to refresh.
            mutateInsights();
          }
        }
      } catch (e) {
        // Best-effort - Feed just stays as whatever was already cached.
      }
    })();
  }, [currentChannel, fetch, mutateInsights]);

  if (isLoadingChannels) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  if (!channels?.length) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-col gap-[15px] transition-all flex-1 justify-center items-center text-center">
        <div className="text-[32px]">
          {t(
            'connect_a_youtube_channel_to_optimize',
            'Connect a YouTube channel to start optimizing your videos'
          )}
        </div>
        <Button onClick={() => router.push('/launches')}>
          {t(
            'go_to_the_calendar_to_add_channels',
            'Go to the calendar to add channels'
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner flex-1 flex-col flex p-[20px] gap-[20px]">
      <ChannelSwitcher
        channels={channels}
        current={current}
        onChange={setCurrent}
      />

      {!!overview && (
        <div className="flex flex-col sm:flex-row gap-[16px]">
          <div className="flex-1 flex flex-col gap-[6px] p-[14px] rounded-[8px] bg-newTableBorder">
            <div className="flex items-center justify-between text-[13px]">
              <div className="font-[500]">
                {t('subscribers', 'Subscribers')}
              </div>
              <div className="opacity-60">
                {formatCount(overview.subscriberCount)} /{' '}
                {formatCount(overview.subscriberMilestone)}
              </div>
            </div>
            <div className="h-[6px] rounded-full bg-fifth overflow-hidden">
              <div
                className="h-full bg-forth"
                style={{
                  width: `${Math.round(overview.subscriberProgress * 100)}%`,
                }}
              />
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-[6px] p-[14px] rounded-[8px] bg-newTableBorder">
            <div className="flex items-center justify-between text-[13px]">
              <div className="font-[500]">{t('total_views', 'Total views')}</div>
              <div className="opacity-60">
                {formatCount(overview.viewCount)} /{' '}
                {formatCount(overview.viewMilestone)}
              </div>
            </div>
            <div className="h-[6px] rounded-full bg-fifth overflow-hidden">
              <div
                className="h-full bg-forth"
                style={{ width: `${Math.round(overview.viewProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[10px]">
        <div className="text-[16px] font-[600]">{t('feed', 'Feed')}</div>

        {!insights?.length && (
          <div className="text-[14px] opacity-60">
            {t(
              'feed_empty_state',
              "No recommendations yet - Vantly is watching this channel and will surface title, thumbnail, tag, and comment suggestions here as soon as it finds something worth improving."
            )}
          </div>
        )}

        {!!insights?.length && !!currentChannel && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-[12px]">
            {insights.map((insight) => (
              <FeedCard
                key={insight.id}
                integrationId={currentChannel.id}
                insight={insight}
                onApplied={refreshInsights}
                onDismiss={() => dismissInsight(insight.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
