'use client';

import { FC } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { Integration } from '@gitroom/frontend/components/youtube-optimizer/youtube.channels.hook';

// Shared between /feed and /optimize - both pages show this same row of
// connected-channel pills when there's more than one, so switching the
// active channel on one page and navigating to the other keeps the same
// selection model instead of two independent pickers.
export const ChannelSwitcher: FC<{
  channels: Integration[];
  current: number;
  onChange: (index: number) => void;
}> = ({ channels, current, onChange }) => {
  if (channels.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-[12px]">
      {channels.map((channel, index) => (
        <div
          key={channel.id}
          onClick={() => onChange(index)}
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
  );
};
