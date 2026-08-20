'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { VideoOptimizerModal } from '@gitroom/frontend/components/youtube-optimizer/video.optimizer.modal';
import { useYoutubeChannels } from '@gitroom/frontend/components/youtube-optimizer/youtube.channels.hook';
import { ChannelSwitcher } from '@gitroom/frontend/components/youtube-optimizer/channel-switcher';

// Phase 1 of the YouTube optimizer (see YOUTUBE_OPTIMIZER_PLAN.md): prove the
// data pipeline end to end - real channel videos, real thumbnails/titles/
// stats, no AI yet. Score badges are placeholders for the batch scoring
// pass that isn't built yet, so "Update scores" stays disabled - but Phase
// 2 wires up the per-video Title/SEO optimizer opened from each card.
//
// Optimizer Phase 7: this page is now just the video library + per-video
// editor (vidIQ's own "Optimize" page - search bar, video grid, done). The
// proactive recommendations that used to live at the top of this page moved
// to their own /feed page/nav entry - see youtube.feed.tsx.
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

  const { channels, isLoadingChannels, current, setCurrent, currentChannel } =
    useYoutubeChannels();

  const openVideoOptimizer = useCallback(
    (
      integrationId: string,
      video: {
        id: string;
        title: string;
        thumbnail?: string;
        viewCount?: string;
        publishedAt?: string;
      },
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
            initialThumbnail={video.thumbnail}
            viewCount={video.viewCount}
            publishedAt={video.publishedAt}
            initialTab={initialTab}
          />
        ),
      });
    },
    [openModal, t]
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
