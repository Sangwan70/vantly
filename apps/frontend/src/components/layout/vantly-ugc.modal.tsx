'use client';

import { FC, useCallback, useState } from 'react';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';

export const VantlyUgcModal: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const { closeCurrent } = useModals();
  const [loading, setLoading] = useState(false);

  const handleContinue = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/user/vantly-ugc-sso');
      const data = await response.json();
      if (data.url) {
        window.open(data.url, '_blank');
      }
      closeCurrent();
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [fetch, closeCurrent]);

  return (
    <div className="flex flex-col gap-[20px] max-w-[520px]">
      <div className="text-[14px] leading-[22px] text-newTextColor opacity-80">
        {t(
          'vantly_ugc_different_company',
          'UGC videos are powered by Vantly UGC (vantly-ugc.com), a separate product with its own account and pricing — not part of your Vantly subscription.'
        )}
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="text-[14px] font-[600] text-newTextColor">
          {t('vantly_ugc_what_you_get', 'What you get with Vantly UGC')}
        </div>
        <ul className="flex flex-col gap-[8px] text-[14px] leading-[20px] text-newTextColor opacity-80">
          <li className="flex gap-[8px]">
            <span className="text-forth">•</span>
            <span>
              {t(
                'vantly_ugc_feature_videos',
                'AI-generated UGC videos with captions written and baked in automatically'
              )}
            </span>
          </li>
          <li className="flex gap-[8px]">
            <span className="text-forth">•</span>
            <span>
              {t(
                'vantly_ugc_feature_quality',
                'Studio-quality 9:16 vertical video at 1080p'
              )}
            </span>
          </li>
          <li className="flex gap-[8px]">
            <span className="text-forth">•</span>
            <span>
              {t(
                'vantly_ugc_feature_publish',
                'Auto-publishing to TikTok, Instagram, YouTube and X'
              )}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-[12px]">
        <div className="text-[14px] font-[600] text-newTextColor">
          {t('vantly_ugc_pricing', 'Separate pricing')}
        </div>
        <div className="flex flex-col gap-[6px] text-[14px] leading-[20px] text-newTextColor opacity-80">
          <div>
            {t('vantly_ugc_plan_creator', 'Creator — $39/mo · 3,900 credits')}
          </div>
          <div>{t('vantly_ugc_plan_pro', 'Pro — $69/mo · 6,900 credits')}</div>
          <div>
            {t(
              'vantly_ugc_plan_pro_plus',
              'Pro Plus — $129/mo · 12,900 credits + early access'
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-[12px] mt-[8px]">
        <Button loading={loading} onClick={handleContinue}>
          {t('vantly_ugc_continue', 'Continue to VantlyUGC')}
        </Button>
        <Button secondary={true} onClick={closeCurrent}>
          {t('cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
};
