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

// Phase 1 of the YouTube optimizer (see YOUTUBE_OPTIMIZER_PLAN.md): prove the
// data pipeline end to end - real channel videos, real thumbnails/titles/
// stats, no AI yet. Score badges are placeholders that later phases wire up;
// "Update scores" is disabled on purpose until Phase 2 lands.
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

  const [current, setCurrent] = useState(0);

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
                  <Button disabled className="!text-[12px] !py-[4px] !px-[10px]">
                    {t('update_scores', 'Update scores')}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
