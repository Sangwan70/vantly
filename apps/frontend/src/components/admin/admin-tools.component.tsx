'use client';

import React, { FC, useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { ImportDebugPostModal } from '@gitroom/frontend/components/launches/import-debug-post.modal';

// Import Debug Post / Add Announcement, moved here from the always-on top
// bar (impersonate.tsx) now that Admin Panel -> Tools is the dedicated
// home for one-off admin utilities that don't have a natural settings
// page of their own (unlike, say, Payment Gateway or Pricing Plans).

const colorOptions = [
  { value: 'INFO', label: 'Info (Blue)', className: 'bg-blue-600' },
  { value: 'WARNING', label: 'Warning (Amber)', className: 'bg-amber-600' },
  { value: 'ERROR', label: 'Error (Red)', className: 'bg-red-600' },
];

const AddAnnouncementModal: FC<{ close: () => void }> = ({ close }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const t = useT();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('INFO');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!title.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await fetch('/announcements', {
        method: 'POST',
        body: JSON.stringify({ title, description, color }),
      });
      await mutate('/announcements');
      close();
    } finally {
      setSaving(false);
    }
  }, [title, description, color]);

  return (
    <div className="flex flex-col gap-[16px] min-w-[500px]">
      <Input
        label={t('announcement_title', 'Title')}
        name="title"
        disableForm={true}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('announcement_title_placeholder', 'Announcement title')}
      />
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_description', 'Description')}
        </label>
        <textarea
          className="bg-input border border-tableBorder rounded-[8px] p-[10px] text-newTextColor min-h-[120px] outline-none resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(
            'announcement_description_placeholder',
            'Announcement description'
          )}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">
          {t('announcement_color', 'Color')}
        </label>
        <div className="flex gap-[8px]">
          {colorOptions.map((opt) => (
            <div
              key={opt.value}
              onClick={() => setColor(opt.value)}
              className={`flex-1 text-center py-[8px] rounded-[8px] text-white text-[13px] cursor-pointer transition-opacity ${opt.className} ${
                color === opt.value ? 'opacity-100 ring-2 ring-white' : 'opacity-40'
              }`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          loading={saving}
          disabled={!title.trim() || !description.trim()}
          className="rounded-[4px]"
        >
          {t('create_announcement', 'Create Announcement')}
        </Button>
      </div>
    </div>
  );
};

const AddAnnouncement: FC = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('add_announcement', 'Add Announcement'),
      children: (close) => <AddAnnouncementModal close={close} />,
    });
  }, []);

  return (
    <Button onClick={handleClick} className="!bg-green-700 rounded-[4px]">
      {t('add_announcement', 'Add Announcement')}
    </Button>
  );
};

const ImportDebugPost: FC = () => {
  const { openModal } = useModals();
  const t = useT();

  const handleClick = useCallback(() => {
    openModal({
      title: t('import_debug_post', 'Import Debug Post'),
      maxSize: 800,
      children: (close) => <ImportDebugPostModal close={close} />,
    });
  }, []);

  return (
    <Button onClick={handleClick} className="!bg-yellow-600 rounded-[4px]">
      {t('import_debug_post', 'Import Debug Post')}
    </Button>
  );
};

export const AdminToolsComponent: FC = () => {
  const user = useUser();

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] text-textColor max-w-[720px]">
      <div className="text-[20px] font-[600]">Tools</div>
      <div className="text-[13px] opacity-70">
        One-off admin utilities that don&apos;t have a settings page of
        their own. These used to live in a toolbar shown at the top of
        every page - they now live here instead.
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[10px]">
        <div className="text-[15px] font-[600]">Announcements</div>
        <div className="text-[12px] opacity-60">
          Post a banner every logged-in user sees at the top of the app
          until dismissed.
        </div>
        <div>
          <AddAnnouncement />
        </div>
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[10px]">
        <div className="text-[15px] font-[600]">Import Debug Post</div>
        <div className="text-[12px] opacity-60">
          Re-import a post from raw debug data - a support/troubleshooting
          tool, not a regular publishing flow.
        </div>
        <div>
          <ImportDebugPost />
        </div>
      </div>
    </div>
  );
};
