'use client';

import { FC, useCallback, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { Textarea } from '@gitroom/react/form/textarea';
import { useToaster } from '@gitroom/react/toaster/toaster';
import {
  ScoreBadge,
  formatCount,
} from '@gitroom/frontend/components/youtube-optimizer/video.optimizer.modal';

// Optimizer Phase 7: vidIQ's "Feed" is a stream of standalone, immediately
// actionable cards (Enhanced Thumbnail / Title Suggestion / Add Missing Tags
// / Unanswered Comments) - each one lets you apply or regenerate right from
// the card, without opening the full Optimize modal first. This mirrors
// that: one component per insight type, each wired straight to the same
// backend endpoints the modal itself uses.

type TitleInsight = {
  id: string;
  type: 'title';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  currentTitle: string;
  currentScore: number;
  suggestion: { title: string; predictedScore: number };
};
type SeoInsight = {
  id: string;
  type: 'seo';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  tags: { tag: string; relevance: number }[];
};
type ThumbnailInsight = {
  id: string;
  type: 'thumbnail';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  currentThumbnail: string;
  newThumbnail: string;
  score: number;
};
type CommentInsight = {
  id: string;
  type: 'comment';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  comment: {
    id: string;
    authorDisplayName: string;
    authorProfileImageUrl: string;
    text: string;
    publishedAt: string;
  };
};
export type FeedInsight = TitleInsight | SeoInsight | ThumbnailInsight | CommentInsight;

type CardShellProps = {
  label: string;
  onDismiss: () => void;
  children: React.ReactNode;
};

const CardShell: FC<CardShellProps> = ({ label, onDismiss, children }) => (
  <div className="flex flex-col gap-[12px] p-[14px] rounded-[10px] bg-newTableBorder">
    <div className="flex items-center justify-between">
      <div className="text-[13px] font-[600]">{label}</div>
      <div
        onClick={onDismiss}
        className="cursor-pointer opacity-50 hover:opacity-100 px-[4px]"
      >
        ✕
      </div>
    </div>
    {children}
  </div>
);

const VideoStrip: FC<{ thumbnail: string; title: string }> = ({
  thumbnail,
  title,
}) => (
  <div className="flex items-center gap-[8px] min-w-0">
    <div className="w-[56px] aspect-video rounded-[6px] overflow-hidden bg-fifth shrink-0">
      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt={title}
          className="w-full h-full object-cover"
        />
      )}
    </div>
    <div className="text-[12px] opacity-60 line-clamp-1" title={title}>
      {title}
    </div>
  </div>
);

export const TitleFeedCard: FC<{
  integrationId: string;
  insight: TitleInsight;
  onApplied: () => void;
  onDismiss: () => void;
}> = ({ integrationId, insight, onApplied, onDismiss }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const [applying, setApplying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/apply`,
        { method: 'POST', body: JSON.stringify({ title: insight.suggestion.title }) }
      );
      if (!response.ok) throw new Error('request failed');
      toaster.show(
        t('title_updated_on_youtube', 'Title updated on YouTube'),
        'success'
      );
      onApplied();
    } catch (e) {
      toaster.show(
        t('failed_to_apply_title', "Couldn't update the title on YouTube"),
        'warning'
      );
    } finally {
      setApplying(false);
    }
  }, [fetch, integrationId, insight, onApplied]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/title-suggestions?regenerate=true`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('request failed');
      onApplied();
    } catch (e) {
      toaster.show(
        t(
          'failed_to_generate_title_suggestions',
          "Couldn't generate title suggestions - you may be out of AI credits"
        ),
        'warning'
      );
    } finally {
      setRegenerating(false);
    }
  }, [fetch, integrationId, insight, onApplied]);

  return (
    <CardShell label={t('title_suggestion', 'Title Suggestion')} onDismiss={onDismiss}>
      <VideoStrip thumbnail={insight.videoThumbnail} title={insight.videoTitle} />
      <div className="flex flex-col gap-[4px]">
        <div className="flex items-center gap-[8px]">
          <ScoreBadge score={insight.currentScore} />
          <div className="text-[13px] line-clamp-1 flex-1" title={insight.currentTitle}>
            {insight.currentTitle}
          </div>
        </div>
        <div className="text-[14px] opacity-40 pl-[4px]">↓</div>
        <div className="flex items-center gap-[8px]">
          <ScoreBadge score={insight.suggestion.predictedScore} />
          <div className="text-[13px] font-[500] line-clamp-1 flex-1" title={insight.suggestion.title}>
            {insight.suggestion.title}
          </div>
        </div>
      </div>
      <div className="flex gap-[8px] justify-end">
        <Button
          secondary
          loading={regenerating}
          onClick={regenerate}
          className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
        >
          {t('regenerate', 'Regenerate')}
        </Button>
        <Button
          loading={applying}
          onClick={apply}
          className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
        >
          {t('apply_title', 'Apply Title')}
        </Button>
      </div>
    </CardShell>
  );
};

export const SeoFeedCard: FC<{
  integrationId: string;
  insight: SeoInsight;
  onApplied: () => void;
  onDismiss: () => void;
}> = ({ integrationId, insight, onApplied, onDismiss }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const [applying, setApplying] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const visibleTags = showAll ? insight.tags : insight.tags.slice(0, 5);
  const remaining = insight.tags.length - visibleTags.length;

  const publish = useCallback(async () => {
    setApplying(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({ tags: insight.tags.map((tag) => tag.tag) }),
        }
      );
      if (!response.ok) throw new Error('request failed');
      toaster.show(
        t('tags_updated_on_youtube', 'Tags updated on YouTube'),
        'success'
      );
      onApplied();
    } catch (e) {
      toaster.show(
        t('failed_to_apply_seo', "Couldn't update the description/tags on YouTube"),
        'warning'
      );
    } finally {
      setApplying(false);
    }
  }, [fetch, integrationId, insight, onApplied]);

  return (
    <CardShell label={t('add_missing_tags', 'Add Missing Tags')} onDismiss={onDismiss}>
      <VideoStrip thumbnail={insight.videoThumbnail} title={insight.videoTitle} />
      <div className="flex flex-wrap gap-[6px]">
        {visibleTags.map((tag) => (
          <div
            key={tag.tag}
            className="flex items-center gap-[6px] text-[12px] pl-[8px] pr-[8px] py-[3px] rounded-full bg-fifth"
          >
            <ScoreBadge score={tag.relevance} className="!px-[6px] !py-[1px] !text-[10px]" />
            {tag.tag}
          </div>
        ))}
        {!!remaining && (
          <div
            onClick={() => setShowAll(true)}
            className="text-[12px] opacity-60 cursor-pointer self-center"
          >
            +{remaining} {t('more', 'more')}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button
          loading={applying}
          onClick={publish}
          className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
        >
          {t('publish_tags', 'Publish tags')}
        </Button>
      </div>
    </CardShell>
  );
};

export const ThumbnailFeedCard: FC<{
  integrationId: string;
  insight: ThumbnailInsight;
  onApplied: () => void;
  onDismiss: () => void;
}> = ({ integrationId, insight, onApplied, onDismiss }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const [applying, setApplying] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const apply = useCallback(async () => {
    setApplying(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/apply-thumbnail`,
        { method: 'POST', body: JSON.stringify({ imageUrl: insight.newThumbnail }) }
      );
      if (!response.ok) throw new Error('request failed');
      toaster.show(
        t('thumbnail_updated_on_youtube', 'Thumbnail updated on YouTube'),
        'success'
      );
      onApplied();
    } catch (e) {
      toaster.show(
        t('failed_to_apply_thumbnail', "Couldn't update the thumbnail on YouTube"),
        'warning'
      );
    } finally {
      setApplying(false);
    }
  }, [fetch, integrationId, insight, onApplied]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/thumbnail`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      if (!response.ok) throw new Error('request failed');
      onApplied();
    } catch (e) {
      toaster.show(
        t(
          'failed_to_generate_thumbnail',
          "Couldn't generate a thumbnail - you may be out of AI image credits"
        ),
        'warning'
      );
    } finally {
      setRegenerating(false);
    }
  }, [fetch, integrationId, insight, onApplied]);

  return (
    <CardShell label={t('enhanced_thumbnail', 'Enhanced Thumbnail')} onDismiss={onDismiss}>
      <div className="flex items-center gap-[10px]">
        <div className="rounded-[8px] overflow-hidden aspect-video bg-fifth flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={insight.currentThumbnail}
            alt={t('current_thumbnail', 'Current thumbnail')}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-[18px] opacity-50 shrink-0">→</div>
        <div className="relative rounded-[8px] overflow-hidden aspect-video bg-fifth flex-1 min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={insight.newThumbnail}
            alt={t('generated_thumbnail', 'Generated thumbnail')}
            className="w-full h-full object-cover"
          />
          <ScoreBadge
            score={insight.score}
            className="!absolute !bottom-[4px] !right-[4px]"
          />
        </div>
      </div>
      <div className="text-[12px] opacity-60 line-clamp-1" title={insight.videoTitle}>
        {insight.videoTitle}
      </div>
      <div className="flex gap-[8px] justify-end">
        <Button
          secondary
          loading={regenerating}
          onClick={regenerate}
          className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
        >
          {t('regenerate', 'Regenerate')}
        </Button>
        <Button
          loading={applying}
          onClick={apply}
          className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
        >
          {t('apply_thumbnail', 'Apply Thumbnail')}
        </Button>
      </div>
    </CardShell>
  );
};

export const CommentFeedCard: FC<{
  integrationId: string;
  insight: CommentInsight;
  onApplied: () => void;
  onDismiss: () => void;
}> = ({ integrationId, insight, onApplied, onDismiss }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);

  const generateReply = useCallback(async () => {
    setDrafting(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/comments/${insight.comment.id}/draft-reply`,
        {
          method: 'POST',
          body: JSON.stringify({ commentText: insight.comment.text }),
        }
      );
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      setDraft(data.reply || '');
    } catch (e) {
      toaster.show(
        t('failed_to_draft_reply', "Couldn't draft a reply - you may be out of AI credits"),
        'warning'
      );
    } finally {
      setDrafting(false);
    }
  }, [fetch, integrationId, insight]);

  const sendReply = useCallback(async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${insight.videoId}/comments/${insight.comment.id}/reply`,
        { method: 'POST', body: JSON.stringify({ text: draft }) }
      );
      if (!response.ok) throw new Error('request failed');
      toaster.show(t('reply_posted', 'Reply posted on YouTube'), 'success');
      onApplied();
    } catch (e) {
      toaster.show(t('failed_to_send_reply', "Couldn't post the reply"), 'warning');
    } finally {
      setSending(false);
    }
  }, [fetch, integrationId, insight, draft, onApplied]);

  return (
    <CardShell label={t('unanswered_comments', 'Unanswered Comments')} onDismiss={onDismiss}>
      <div className="flex items-start justify-between gap-[10px]">
        <div className="flex items-start gap-[8px] min-w-0 flex-1">
          {insight.comment.authorProfileImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={insight.comment.authorProfileImageUrl}
              alt={insight.comment.authorDisplayName}
              className="w-[28px] h-[28px] rounded-full shrink-0"
            />
          )}
          <div className="flex flex-col gap-[2px] min-w-0">
            <div className="text-[13px] font-[500]">
              {insight.comment.authorDisplayName}
            </div>
            <div className="text-[13px] opacity-90 line-clamp-3">
              {insight.comment.text}
            </div>
          </div>
        </div>
        <div className="w-[100px] shrink-0">
          <VideoStrip thumbnail={insight.videoThumbnail} title={insight.videoTitle} />
        </div>
      </div>

      {!draft && (
        <div className="flex justify-end">
          <Button
            loading={drafting}
            onClick={generateReply}
            className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
          >
            {t('generate_response', 'Generate response')}
          </Button>
        </div>
      )}

      {!!draft && (
        <>
          <Textarea
            disableForm
            label={t('your_reply', 'Your reply')}
            name="replyDraft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="!min-h-[80px]"
          />
          <div className="flex gap-[8px] justify-end">
            <Button
              secondary
              loading={drafting}
              onClick={generateReply}
              className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
            >
              {t('regenerate', 'Regenerate')}
            </Button>
            <Button
              loading={sending}
              disabled={!draft.trim()}
              onClick={sendReply}
              className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
            >
              {t('send_reply', 'Send reply')}
            </Button>
          </div>
        </>
      )}
    </CardShell>
  );
};

export const FeedCard: FC<{
  integrationId: string;
  insight: FeedInsight;
  onApplied: () => void;
  onDismiss: () => void;
}> = ({ integrationId, insight, onApplied, onDismiss }) => {
  switch (insight.type) {
    case 'title':
      return (
        <TitleFeedCard
          integrationId={integrationId}
          insight={insight}
          onApplied={onApplied}
          onDismiss={onDismiss}
        />
      );
    case 'seo':
      return (
        <SeoFeedCard
          integrationId={integrationId}
          insight={insight}
          onApplied={onApplied}
          onDismiss={onDismiss}
        />
      );
    case 'thumbnail':
      return (
        <ThumbnailFeedCard
          integrationId={integrationId}
          insight={insight}
          onApplied={onApplied}
          onDismiss={onDismiss}
        />
      );
    case 'comment':
      return (
        <CommentFeedCard
          integrationId={integrationId}
          insight={insight}
          onApplied={onApplied}
          onDismiss={onDismiss}
        />
      );
    default:
      return null;
  }
};
