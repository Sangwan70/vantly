'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';

export type Integration = {
  id: string;
  name: string;
  picture: string;
  identifier: string;
  disabled: boolean;
  refreshNeeded: boolean;
};

// Feed (proactive recommendations) and Optimize (the video library +
// per-video editor) are now two separate pages, but both need the same
// "which connected YouTube channel is active" state - this hook is the one
// place that lives, instead of two copies that could drift.
export const useYoutubeChannels = () => {
  const fetch = useFetch();
  const [current, setCurrent] = useState(0);

  const loadChannels = useCallback(async () => {
    const integrations = (
      await (await fetch('/integrations/list')).json()
    ).integrations as Integration[];
    // Phase 1 only implements listVideos on the YouTube provider, so both
    // pages (whose entire purpose is YouTube optimization) filter to it
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

  return { channels, isLoadingChannels, current, setCurrent, currentChannel };
};
