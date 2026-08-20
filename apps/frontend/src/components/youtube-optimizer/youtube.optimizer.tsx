'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { VideoOptimizerModal } from '@gitroom/frontend/components/youtube-optimizer/video.optimizer.modal';

// Phase 1 of the YouTube optimizer (see YOUTUBE_OPTIMIZER_PLAN.md): prove the
// data pipeline end to end - real channel videos, real thumbnails/titles/
// stats, no AI yet. Score badges are placeholders for the batch scoring
// pass that isn't built yet, so "Update scores" stays disabled - but Phase
// 2 wires up the per-video Title/SEO optimizer opened from each card.
type VideoListItem = {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  viewCount: string;
  likeCount: string;
  commentCount: string;
};

type Integration = {
  id: string;
  name: string;
  picture: string;
  identifier: string;
  disabled: boolean;
  refreshNeeded: boolean;
};

// Optimizer Phase 6
type ChannelOverview = {
  subscriberCount: number;
  subscriberMilestone: number;
  subscriberProgress: number;
  viewCount: number;
  viewMilestone: number;
  viewProgress: number;
  videoCount: number;
};

type InsightCard = {
  id: string;
  type: 'title' | 'seo' | 'comment';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  message: string;
};

const INSIGHT_TAB_BY_TYPE: Record<
  InsightCard['type'],
  'title' | 'seo' | 'comments'
> = {
  title: 'title',
  seo: 'seo',
  comment: 'comments',
};

const formatCount = (value: string) => {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(num);
};

const ScorePill = () => (
  <div className="text-[11px] px-[8px] py-[2px] rounded-full bg-fifth text-textColor opacity-60">
    —
  </div>
);

export const YoutubeOptimizer = () => {
  const fetch = useFetch();
  const t = useT();
  const router = useRouter();
  const { openModal } = useModals();

  const [current, setCurrent] = useState(0);

  const openVideoOptimizer = useCallback(
    (
      integrationId: string,
      video: { id: string; title: string },
      initialTab?: 'title' | 'seo' | 'thumbnail' | 'comments' | 'review'
    ) => {
      openModal({
        title: t('optimize_video', 'Optimize video'),
        closeOnClickOutside: true,
        closeOnEscape: true,
        children: (
          <VideoOptimizerModal
            integrationId={integrationId}
            videoId={video.id}
            initialTitle={video.title}
            initialTab={initialTab}
          />
        ),
      });
    },
    [openModal, t]
  );

  const loadChannels = useCallback(async () => {
    const integrations = (
      await (await fetch('/integrations/list')).json()
    ).integrations as Integration[];
    // Phase 1 only implements listVideos on the YouTube provider, so this
    // page (whose entire purpose is YouTube optimization) filters to it
    // client-side - the same pattern platform.analytics.tsx already uses
    // for its own per-provider allow-list.
    return integrations.filter((i) => i.identifier === 'youtube');
  }, []);

  const { data: channels, isLoading: isLoadingChannels } = useSWR(
    'optimize-youtube-channels',
    loadChannels,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      fallbackData: [],
    }
  );

  const currentChannel = useMemo(
    () => channels?.[current],
    [channels, current]
  );

  const loadVideos = useCallback(async () => {
    if (!currentChannel) {
      return { videos: [] as VideoListItem[], nextPageToken: undefined };
    }
    return (await (
      await fetch(`/integrations/${currentChannel.id}/videos`)
    ).json()) as { videos: VideoListItem[]; nextPageToken?: string };
  }, [currentChannel]);

  const { data: videoData, isLoading: isLoadingVideos } = useSWR(
    currentChannel ? `optimize-youtube-videos-${currentChannel.id}` : null,
    loadVideos,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
    }
  );

  // Optimizer Phase 6: channel-home milestone bars + the proactive insights
  // feed, each its own SWR hook per the one-hook-per-query rule (see
  // youtube.optimizer.tsx's Phase 1 comment / CLAUDE.md). Both are cheap,
  // non-AI reads - see YoutubeOptimizerService.getChannelOverview /
  // .getInsightsFeed for why neither one spends a credit just by loading.
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
    if (!currentChannel) return [] as InsightCard[];
    return (await (
      await fetch(`/youtube-optimizer/${currentChannel.id}/insights`)
    ).json()) as InsightCard[];
  }, [currentChannel]);

  const {
    data: insights,
    mutate: mutateInsights,
  } = useSWR(
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

  const openInsight = useCallback(
    (insight: InsightCard) => {
      if (!currentChannel) return;
      openVideoOptimizer(
        currentChannel.id,
        { id: insight.videoId, title: insight.videoTitle },
        INSIGHT_TAB_BY_TYPE[insight.type]
      );
    },
    [currentChannel, openVideoOptimizer]
  );

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
      {channels.length > 1 && (
        <div className="flex gap-[12px]">
          {channels.map((channel, index) => (
            <div
              key={channel.id}
              onClick={() => setCurrent(index)}
              className={clsx(
                'flex items-center gap-[8px] px-[12px] py-[6px] rounded-[8px] cursor-pointer select-none',
                current === index
                  ? 'bg-btnSimple text-btnText'
                  : 'opacity-60 hover:opacity-100'
              )}
            >
              <ImageWithFallback
                fallbackSrc={`/icons/platforms/youtube.png`}
                src={channel.picture}
                className="rounded-full"
                alt={channel.name}
                width={24}
                height={24}
              />
              <div>{channel.name}</div>
            </div>
          ))}
        </div>
      )}

      {!!overview && (
        <div className="flex flex-col sm:flex-row gap-[16px]">
          <div className="flex-1 flex flex-col gap-[6px] p-[14px] rounded-[8px] bg-newTableBorder">
            <div className="flex items-center justify-between text-[13px]">
              <div className="font-[500]">
                {t('subscribers', 'Subscribers')}
              </div>
              <div className="opacity-60">
                {formatCount(String(overview.subscriberCount))} /{' '}
                {formatCount(String(overview.subscriberMilestone))}
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
                {formatCount(String(overview.viewCount))} /{' '}
                {formatCount(String(overview.viewMilestone))}
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

      {!!insights?.length && (
        <div className="flex flex-col gap-[10px]">
          <div className="text-[16px] font-[600]">
            {t('insights', 'Insights')}
          </div>
          <div className="flex flex-col gap-[8px]">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="flex items-center gap-[10px] p-[10px] rounded-[8px] bg-newTableBorder"
              >
                <div className="w-[64px] aspect-video rounded-[6px] overflow-hidden bg-fifth shrink-0">
                  {insight.videoThumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={insight.videoThumbnail}
                      alt={insight.videoTitle}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-[2px] min-w-0">
                  <div
                    className="text-[12px] opacity-60 line-clamp-1"
                    title={insight.videoTitle}
                  >
                    {insight.videoTitle}
                  </div>
                  <div className="text-[13px] line-clamp-2">
                    {insight.message}
                  </div>
                </div>
                <Button
                  secondary
                  onClick={() => openInsight(insight)}
                  className="!text-[12px] !py-[4px] !px-[10px] !h-auto shrink-0"
                >
                  {t('view', 'View')}
                </Button>
                <div
                  onClick={() => dismissInsight(insight.id)}
                  className="cursor-pointer opacity-50 hover:opacity-100 px-[4px] shrink-0"
                  title={t('dismiss', 'Dismiss')}
                >
                  ✕
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-[24px] font-[600]">
        {t('video_library', 'Video Library')}
      </div>

      {isLoadingVideos && (
        <div className="flex flex-1 items-center justify-center">
          <LoadingComponent />
        </div>
      )}

      {!isLoadingVideos && !videoData?.videos?.length && (
        <div className="opacity-60">
          {t('no_videos_found_on_this_channel', 'No videos found on this channel yet.')}
        </div>
      )}

      {!!videoData?.videos?.length && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[16px]">
          {videoData.videos.map((video) => (
            <div
              key={video.id}
              className="flex flex-col gap-[8px] rounded-[8px] overflow-hidden bg-newTableBorder"
            >
              <div className="relative aspect-video bg-fifth">
                {video.thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex flex-col gap-[6px] p-[10px]">
                <div
                  className="text-[14px] font-[500] line-clamp-2"
                  title={video.title}
                >
                  {video.title}
                </div>
                <div className="text-[12px] opacity-60">
                  {formatCount(video.viewCount)}{' '}
                  {t('views', 'views')} · {formatCount(video.likeCount)}{' '}
                  {t('likes', 'likes')} · {formatCount(video.commentCount)}{' '}
                  {t('comments', 'comments')}
                </div>
                <div className="flex items-center gap-[6px] pt-[4px]">
                  <ScorePill />
                  <ScorePill />
                  <ScorePill />
                  <div className="flex-1" />
                  <Button
                    disabled
                    className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
                  >
                    {t('update_scores', 'Update scores')}
                  </Button>
                </div>
                <Button
                  secondary
                  onClick={() =>
                    currentChannel &&
                    openVideoOptimizer(currentChannel.id, video)
                  }
                  className="!text-[12px] !py-[6px] !px-[10px] !h-auto"
                >
                  {t('optimize', 'Optimize')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
