'use client';

import React, { FC, useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Button } from '@gitroom/react/form/button';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import {
  errorMessage,
  InboxComment,
  usePromoteComments,
} from '@gitroom/frontend/components/promote/promote.hooks';

type Tone = 'friendly' | 'professional' | 'playful';

const selectClass =
  'bg-newBgColorInner h-[34px] border border-newTableBorder rounded-[8px] px-[8px] text-[13px] text-textColor';

const ago = (iso?: string) => {
  if (!iso) return '';
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

const CommentRow: FC<{
  integrationId: string;
  comment: InboxComment;
  onSent: () => void;
}> = ({ integrationId, comment, onSent }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [tone, setTone] = useState<Tone>('friendly');
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null);

  const draft = useCallback(async () => {
    setBusy('draft');
    try {
      const res = await fetch(`/promote/comments/${integrationId}/draft`, {
        method: 'POST',
        body: JSON.stringify({ commentId: comment.id, tone }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not draft a reply'), 'warning');
        return;
      }
      setText((await res.json()).reply || '');
    } finally {
      setBusy(null);
    }
  }, [integrationId, comment.id, tone, fetch, toaster]);

  const send = useCallback(async () => {
    if (!text.trim()) return;
    setBusy('send');
    try {
      const res = await fetch(`/promote/comments/${integrationId}/reply`, {
        method: 'POST',
        body: JSON.stringify({ commentId: comment.id, message: text.trim() }),
      });
      if (!res.ok) {
        toaster.show(await errorMessage(res, 'Could not send the reply'), 'warning');
        return;
      }
      toaster.show('Reply sent', 'success');
      setOpen(false);
      setText('');
      onSent();
    } finally {
      setBusy(null);
    }
  }, [integrationId, comment.id, text, fetch, toaster, onSent]);

  return (
    <div className="border-t border-newTableBorder py-[10px] flex flex-col gap-[6px]">
      <div className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0">
          <div className="text-[13px]">
            <span className="font-[600]">@{comment.username}</span>{' '}
            <span className="opacity-50 text-[11px]">
              {ago(comment.timestamp)}
              {comment.likeCount ? ` · ${comment.likeCount} likes` : ''}
            </span>
          </div>
          <div className="text-[13px] whitespace-pre-line break-words">{comment.text}</div>
        </div>
        <div className="shrink-0 text-[12px]">
          {comment.own ? (
            <span className="opacity-50">Your comment</span>
          ) : comment.replied ? (
            <span className="text-green-400">Replied</span>
          ) : (
            <button className="underline" onClick={() => setOpen((o) => !o)}>
              {open ? 'Close' : 'Reply'}
            </button>
          )}
        </div>
      </div>

      {comment.replies.map((r) => (
        <div key={r.id} className="ml-[16px] pl-[10px] border-l border-newTableBorder text-[12px] opacity-80">
          <span className="font-[600]">@{r.username}</span> {r.text}
        </div>
      ))}

      {open && !comment.replied && (
        <div className="ml-[16px] flex flex-col gap-[8px]">
          <textarea
            className="bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[10px] text-[13px] text-textColor min-h-[70px]"
            placeholder="Write a reply, or draft one with AI and edit it before sending"
            value={text}
            maxLength={2200}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-[8px]">
            <select className={selectClass} value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
              <option value="friendly">Friendly</option>
              <option value="professional">Professional</option>
              <option value="playful">Playful</option>
            </select>
            <Button secondary onClick={draft} loading={busy === 'draft'}>
              Draft with AI
            </Button>
            <Button onClick={send} loading={busy === 'send'} disabled={!text.trim()}>
              Send reply
            </Button>
            <span className="text-[11px] opacity-50">Nothing is posted until you press Send.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const Comments: FC<{ integrationId: string }> = ({ integrationId }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const { data, isLoading, error } = usePromoteComments(integrationId);
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/promote/comments/${integrationId}?refresh=true`);
      if (res.ok) {
        await mutate(`promote-comments-${integrationId}`, await res.json(), {
          revalidate: false,
        });
      }
    } finally {
      setRefreshing(false);
    }
  }, [integrationId, fetch, mutate]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-[40px]">
        <LoadingComponent />
      </div>
    );
  }
  if (error) {
    return <div className="p-[20px] text-[14px] text-red-400">{(error as Error).message}</div>;
  }

  const posts = (data?.posts || [])
    .map((p) => ({
      ...p,
      comments: onlyOpen ? p.comments.filter((c) => c.needsReply) : p.comments,
    }))
    .filter((p) => p.comments.length);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-center gap-[12px]">
        <div className="text-[14px] font-[600]">
          {data?.unanswered ?? 0} comment{data?.unanswered === 1 ? '' : 's'} waiting for a reply
        </div>
        <label className="flex items-center gap-[6px] text-[13px]">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Unanswered only
        </label>
        <Button secondary onClick={refresh} loading={refreshing}>
          Refresh
        </Button>
        <span className="text-[11px] opacity-50">Covers your 10 most recent posts.</span>
      </div>

      {!posts.length && (
        <div className="border border-newTableBorder rounded-[8px] p-[24px] text-center text-[14px] opacity-80">
          {onlyOpen ? 'You are all caught up.' : 'No comments on your recent posts yet.'}
        </div>
      )}

      {posts.map((p) => (
        <div key={p.media.id} className="border border-newTableBorder rounded-[8px] p-[14px]">
          <a
            href={p.media.permalink}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-[10px] mb-[6px]"
          >
            {p.media.thumbnailUrl ? (
              <img src={p.media.thumbnailUrl} className="w-[44px] h-[44px] rounded object-cover" alt="" />
            ) : (
              <div className="w-[44px] h-[44px] rounded bg-white/10" />
            )}
            <div className="min-w-0">
              <div className="text-[13px] truncate">{p.media.caption || '(no caption)'}</div>
              <div className="text-[11px] opacity-60">
                {ago(p.media.timestamp)} · {p.media.commentsCount ?? p.comments.length} comments
              </div>
            </div>
          </a>
          {p.comments.map((c) => (
            <CommentRow
              key={c.id}
              integrationId={integrationId}
              comment={c}
              onSent={() => mutate(`promote-comments-${integrationId}`)}
            />
          ))}
        </div>
      ))}
    </div>
  );
};
