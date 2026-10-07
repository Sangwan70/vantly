'use client';

import React, { FC, useEffect, useMemo, useState } from 'react';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { Hashtags } from '@gitroom/frontend/components/promote/hashtags.component';
import { Competitors } from '@gitroom/frontend/components/promote/competitors.component';
import { usePromoteAccounts } from '@gitroom/frontend/components/promote/promote.hooks';

type TabKey = 'competitors' | 'hashtags';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'competitors', label: 'Competitors' },
  { key: 'hashtags', label: 'Hashtags' },
];

const selectClass =
  'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor';

export const Promote: FC = () => {
  const { data: accounts, isLoading } = usePromoteAccounts();
  const [accountId, setAccountId] = useState<string>('');
  const [tab, setTab] = useState<TabKey>('competitors');

  const eligible = useMemo(
    () => (accounts || []).filter((a) => a.eligible),
    [accounts]
  );
  const blocked = useMemo(
    () => (accounts || []).filter((a) => !a.eligible),
    [accounts]
  );

  // Default to the first usable account once the list loads.
  useEffect(() => {
    if (!accountId && eligible.length) {
      setAccountId(eligible[0].id);
    }
  }, [accountId, eligible]);

  if (isLoading) {
    return (
      <div className="bg-newBgColorInner p-[20px] flex flex-1 items-center justify-center">
        <LoadingComponent />
      </div>
    );
  }

  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[16px] text-textColor">
      <div className="flex flex-wrap items-center justify-between gap-[12px]">
        <div>
          <div className="text-[20px] font-[600]">Promote</div>
          <div className="text-[13px] opacity-70">
            Research competitors and grow your Instagram account, using only Meta's official API.
          </div>
        </div>
        {eligible.length > 0 && (
          <select
            className={selectClass}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {eligible.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!accounts?.length && (
        <div className="border border-newTableBorder rounded-[8px] p-[24px] text-center text-[14px] opacity-80">
          Connect an Instagram account from the Launches page to use Promote.
        </div>
      )}

      {blocked.map((a) => (
        <div
          key={a.id}
          className="border border-newTableBorder rounded-[8px] px-[14px] py-[10px] text-[13px] flex items-center gap-[10px]"
        >
          {a.picture && <img src={a.picture} className="w-[24px] h-[24px] rounded-full" alt="" />}
          <div>
            <span className="font-[600]">{a.name}</span>{' '}
            <span className="opacity-70">{a.reason}</span>
          </div>
        </div>
      ))}

      {eligible.length > 0 && accountId && (
        <>
          <div className="flex gap-[6px] border-b border-newTableBorder">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`px-[14px] py-[8px] text-[14px] border-b-2 ${
                  tab === t.key ? 'border-[#7c5cff] font-[600]' : 'border-transparent opacity-70'
                }`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'competitors' && <Competitors key={accountId} integrationId={accountId} />}
          {tab === 'hashtags' && <Hashtags key={accountId} integrationId={accountId} />}
        </>
      )}
    </div>
  );
};
