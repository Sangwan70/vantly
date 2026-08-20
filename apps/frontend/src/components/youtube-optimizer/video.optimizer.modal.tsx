'use client';

import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { Button } from '@gitroom/react/form/button';
import { Textarea } from '@gitroom/react/form/textarea';
import { Input } from '@gitroom/react/form/input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useToaster } from '@gitroom/react/toaster/toaster';

// YouTube Optimizer Phase 2 added Title + SEO. Phase 3 adds Thumbnail (3 of
// the 5 tabs in the full vidIQ-style plan - Review/Preview land later).
// Title/SEO "Generate" burns a cheap youtube_text_suggestions credit and is
// cached server-side ("Regenerate" bypasses that cache); Thumbnail
// "Quick Generate" is a full image generation (the existing ai_images pool)
// and is never cached - every click is a deliberate new image.
type TitleSuggestion = {
  title: string;
  predictedScore: number;
  rationale: string;
};
type SimilarVideo = { title: string; channelTitle: string; viewCount: string };
type TitleSuggestions = {
  currentScore: number;
  suggestions: TitleSuggestion[];
  // Optimizer Phase 6: real competing videos the suggestions were
  // benchmarked against - empty when the provider doesn't support search or
  // no similar videos were found, in which case the section is just hidden.
  similarVideos?: SimilarVideo[];
};
type SeoTag = { tag: string; relevance: number };
type SeoSuggestions = { description: string; tags: SeoTag[] };
type ThumbnailResult = {
  imageUrl: string;
  feedback: { score: number; pros: string[]; cons: string[] };
};
type VideoComment = {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  text: string;
  publishedAt: string;
  likeCount: number;
  totalReplyCount: number;
  hasChannelOwnerReply: boolean;
};
type ReviewCategoryKey = 'hook' | 're_hooks_pacing' | 'broll_editing' | 'cta';
type ReviewItem = {
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  note: string;
};
type ReviewCategory = { category: ReviewCategoryKey; items: ReviewItem[] };
type VideoReview = {
  overallScore: number;
  summary: string;
  categories: ReviewCategory[];
};
type ReviewResult =
  | { available: true; review: VideoReview }
  | { available: false; reason: 'no_captions' };

const CATEGORY_LABELS: Record<ReviewCategoryKey, string> = {
  hook: 'The Hook',
  re_hooks_pacing: 'Re-Hooks & Pacing',
  broll_editing: 'B-roll & Editing',
  cta: 'Call To Action',
};

const SEVERITY_COLOR: Record<'low' | 'medium' | 'high', string> = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-red-500',
};

export const VideoOptimizerModal: FC<{
  integrationId: string;
  videoId: string;
  initialTitle: string;
  // Optimizer Phase 6: the insights feed deep-links straight into the
  // relevant tab (e.g. opening a "better title ready" card should land on
  // Title, not always default to it) - optional so every existing caller
  // (the video grid's plain "Optimize" button) keeps working unchanged.
  initialTab?: 'title' | 'seo' | 'thumbnail' | 'comments' | 'review';
}> = ({ integrationId, videoId, initialTitle, initialTab }) => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const { closeCurrent } = useModals();

  const [tab, setTab] = useState<
    'title' | 'seo' | 'thumbnail' | 'comments' | 'review'
  >(initialTab || 'title');
  const playerRef = useRef<HTMLIFrameElement | null>(null);

  const [titleData, setTitleData] = useState<TitleSuggestions | null>(null);
  const [titleLoading, setTitleLoading] = useState(false);
  const [applyingTitle, setApplyingTitle] = useState<string | null>(null);

  const [seoData, setSeoData] = useState<SeoSuggestions | null>(null);
  const [seoLoading, setSeoLoading] = useState(false);
  const [seoDescription, setSeoDescription] = useState('');
  const [applyingSeo, setApplyingSeo] = useState(false);

  const [thumbnailPrompt, setThumbnailPrompt] = useState('');
  const [thumbnailResult, setThumbnailResult] =
    useState<ThumbnailResult | null>(null);
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const [applyingThumbnail, setApplyingThumbnail] = useState(false);

  const [comments, setComments] = useState<VideoComment[] | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [handledCommentIds, setHandledCommentIds] = useState<Set<string>>(
    new Set()
  );
  const [replyDraft, setReplyDraft] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const generateTitles = useCallback(
    async (regenerate = false) => {
      setTitleLoading(true);
      try {
        const response = await fetch(
          `/youtube-optimizer/${integrationId}/videos/${videoId}/title-suggestions${
            regenerate ? '?regenerate=true' : ''
          }`,
          { method: 'POST' }
        );
        if (!response.ok) {
          throw new Error('request failed');
        }
        setTitleData(await response.json());
      } catch (e) {
        toaster.show(
          t(
            'failed_to_generate_title_suggestions',
            "Couldn't generate title suggestions - you may be out of AI credits"
          ),
          'warning'
        );
      } finally {
        setTitleLoading(false);
      }
    },
    [fetch, integrationId, videoId]
  );

  const generateSeo = useCallback(
    async (regenerate = false) => {
      setSeoLoading(true);
      try {
        const response = await fetch(
          `/youtube-optimizer/${integrationId}/videos/${videoId}/seo-suggestions${
            regenerate ? '?regenerate=true' : ''
          }`,
          { method: 'POST' }
        );
        if (!response.ok) {
          throw new Error('request failed');
        }
        const data = await response.json();
        setSeoData(data);
        setSeoDescription(data.description || '');
      } catch (e) {
        toaster.show(
          t(
            'failed_to_generate_seo_suggestions',
            "Couldn't generate SEO suggestions - you may be out of AI credits"
          ),
          'warning'
        );
      } finally {
        setSeoLoading(false);
      }
    },
    [fetch, integrationId, videoId]
  );

  const applyTitle = useCallback(
    async (title: string) => {
      setApplyingTitle(title);
      try {
        const response = await fetch(
          `/youtube-optimizer/${integrationId}/videos/${videoId}/apply`,
          {
            method: 'POST',
            body: JSON.stringify({ title }),
          }
        );
        if (!response.ok) {
          throw new Error('request failed');
        }
        toaster.show(
          t('title_updated_on_youtube', 'Title updated on YouTube'),
          'success'
        );
      } catch (e) {
        toaster.show(
          t(
            'failed_to_apply_title',
            "Couldn't update the title on YouTube"
          ),
          'warning'
        );
      } finally {
        setApplyingTitle(null);
      }
    },
    [fetch, integrationId, videoId]
  );

  const applySeo = useCallback(async () => {
    if (!seoData) return;
    setApplyingSeo(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/apply`,
        {
          method: 'POST',
          body: JSON.stringify({
            description: seoDescription,
            tags: seoData.tags.map((tag) => tag.tag),
          }),
        }
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      toaster.show(
        t(
          'seo_updated_on_youtube',
          'Description and tags updated on YouTube'
        ),
        'success'
      );
    } catch (e) {
      toaster.show(
        t(
          'failed_to_apply_seo',
          "Couldn't update the description/tags on YouTube"
        ),
        'warning'
      );
    } finally {
      setApplyingSeo(false);
    }
  }, [fetch, integrationId, videoId, seoDescription, seoData]);

  const generateThumbnail = useCallback(async () => {
    setThumbnailLoading(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/thumbnail`,
        {
          method: 'POST',
          body: JSON.stringify({ prompt: thumbnailPrompt || undefined }),
        }
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      setThumbnailResult(await response.json());
    } catch (e) {
      toaster.show(
        t(
          'failed_to_generate_thumbnail',
          "Couldn't generate a thumbnail - you may be out of AI image credits"
        ),
        'warning'
      );
    } finally {
      setThumbnailLoading(false);
    }
  }, [fetch, integrationId, videoId, thumbnailPrompt]);

  const applyThumbnail = useCallback(async () => {
    if (!thumbnailResult) return;
    setApplyingThumbnail(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/apply-thumbnail`,
        {
          method: 'POST',
          body: JSON.stringify({ imageUrl: thumbnailResult.imageUrl }),
        }
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      toaster.show(
        t('thumbnail_updated_on_youtube', 'Thumbnail updated on YouTube'),
        'success'
      );
    } catch (e) {
      toaster.show(
        t(
          'failed_to_apply_thumbnail',
          "Couldn't update the thumbnail on YouTube"
        ),
        'warning'
      );
    } finally {
      setApplyingThumbnail(false);
    }
  }, [fetch, integrationId, videoId, thumbnailResult]);

  const remainingComments = useMemo(
    () => (comments || []).filter((c) => !handledCommentIds.has(c.id)),
    [comments, handledCommentIds]
  );
  const currentComment = remainingComments[0];

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/comments`
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      setComments(await response.json());
    } catch (e) {
      toaster.show(
        t('failed_to_load_comments', "Couldn't load comments"),
        'warning'
      );
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [fetch, integrationId, videoId]);

  // Comments are a free read (no AI cost), so load them automatically the
  // first time the tab is opened rather than requiring an extra click, unlike
  // Title/SEO/Thumbnail which are all deliberately click-to-generate because
  // they cost credits.
  useEffect(() => {
    if (tab === 'comments' && comments === null && !commentsLoading) {
      loadComments();
    }
  }, [tab, comments, commentsLoading, loadComments]);

  useEffect(() => {
    setReplyDraft('');
  }, [currentComment?.id]);

  const generateReply = useCallback(async () => {
    if (!currentComment) return;
    setDraftLoading(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/comments/${currentComment.id}/draft-reply`,
        {
          method: 'POST',
          body: JSON.stringify({ commentText: currentComment.text }),
        }
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      const data = await response.json();
      setReplyDraft(data.reply || '');
    } catch (e) {
      toaster.show(
        t(
          'failed_to_draft_reply',
          "Couldn't draft a reply - you may be out of AI credits"
        ),
        'warning'
      );
    } finally {
      setDraftLoading(false);
    }
  }, [fetch, integrationId, videoId, currentComment]);

  const sendReply = useCallback(async () => {
    if (!currentComment || !replyDraft.trim()) return;
    setSendingReply(true);
    try {
      const response = await fetch(
        `/youtube-optimizer/${integrationId}/videos/${videoId}/comments/${currentComment.id}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ text: replyDraft }),
        }
      );
      if (!response.ok) {
        throw new Error('request failed');
      }
      setHandledCommentIds((prev) => new Set(prev).add(currentComment.id));
      toaster.show(
        t('reply_posted', 'Reply posted on YouTube'),
        'success'
      );
    } catch (e) {
      toaster.show(
        t('failed_to_send_reply', "Couldn't post the reply"),
        'warning'
      );
    } finally {
      setSendingReply(false);
    }
  }, [fetch, integrationId, videoId, currentComment, replyDraft]);

  const skipComment = useCallback(() => {
    if (!currentComment) return;
    setHandledCommentIds((prev) => new Set(prev).add(currentComment.id));
  }, [currentComment]);

  const generateReview = useCallback(
    async (regenerate = false) => {
      setReviewLoading(true);
      try {
        const response = await fetch(
          `/youtube-optimizer/${integrationId}/videos/${videoId}/review${
            regenerate ? '?regenerate=true' : ''
          }`,
          { method: 'POST' }
        );
        if (!response.ok) {
          throw new Error('request failed');
        }
        setReviewResult(await response.json());
      } catch (e) {
        toaster.show(
          t(
            'failed_to_generate_review',
            "Couldn't generate a video review - you may be out of AI credits"
          ),
          'warning'
        );
      } finally {
        setReviewLoading(false);
      }
    },
    [fetch, integrationId, videoId]
  );

  // Seeks the embedded YouTube iframe player via its postMessage API
  // (enablejsapi=1 on the src) rather than a full player SDK - all we need
  // is seekTo/playVideo when a timestamp in the review is clicked.
  const seekTo = useCallback((timestamp: string) => {
    const parts = timestamp.split(':').map((p) => parseInt(p, 10) || 0);
    const seconds =
      parts.length === 3
        ? parts[0] * 3600 + parts[1] * 60 + parts[2]
        : parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] || 0;

    const target = playerRef.current?.contentWindow;
    if (!target) return;

    target.postMessage(
      JSON.stringify({
        event: 'command',
        func: 'seekTo',
        args: [seconds, true],
      }),
      'https://www.youtube.com'
    );
    target.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
      'https://www.youtube.com'
    );
  }, []);

  return (
    <div className="flex flex-col gap-[16px] max-w-[640px] w-[90vw]">
      <div className="text-[16px] font-[600] line-clamp-1" title={initialTitle}>
        {initialTitle}
      </div>

      <div className="flex gap-[16px] border-b border-newTableBorder">
        {(['title', 'seo', 'thumbnail', 'comments', 'review'] as const).map((key) => (
          <div
            key={key}
            onClick={() => setTab(key)}
            className={clsx(
              'px-[4px] py-[8px] cursor-pointer select-none text-[14px]',
              tab === key
                ? 'border-b-2 border-forth font-[600]'
                : 'opacity-60'
            )}
          >
            {key === 'title' && t('title', 'Title')}
            {key === 'seo' && t('seo', 'SEO')}
            {key === 'thumbnail' && t('thumbnail', 'Thumbnail')}
            {key === 'comments' && t('comments', 'Comments')}
            {key === 'review' && t('review', 'Review')}
          </div>
        ))}
      </div>

      {tab === 'title' && (
        <div className="flex flex-col gap-[12px]">
          {!titleData && (
            <Button loading={titleLoading} onClick={() => generateTitles(false)}>
              {t('generate_title_suggestions', 'Generate title suggestions')}
            </Button>
          )}
          {!!titleData && (
            <>
              <div className="text-[13px] opacity-70">
                {t('current_title_score', 'Current title score')}:{' '}
                {titleData.currentScore}/100
              </div>
              <div className="flex flex-col gap-[10px] max-h-[360px] overflow-y-auto">
                {titleData.suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-[6px] p-[10px] rounded-[8px] bg-newTableBorder"
                  >
                    <div className="text-[14px] font-[500]">
                      {suggestion.title}
                    </div>
                    <div className="text-[12px] opacity-70">
                      {suggestion.rationale}
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <div className="text-[12px] opacity-60">
                        {t('predicted_score', 'Predicted score')}:{' '}
                        {suggestion.predictedScore}/100
                      </div>
                      <div className="flex-1" />
                      <Button
                        loading={applyingTitle === suggestion.title}
                        onClick={() => applyTitle(suggestion.title)}
                        className="!text-[12px] !py-[4px] !px-[10px] !h-auto"
                      >
                        {t('use_this_title', 'Use this title')}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {!!titleData.similarVideos?.length && (
                <div className="flex flex-col gap-[6px]">
                  <div className="text-[13px] font-[500]">
                    {t(
                      'benchmarked_against_similar_videos',
                      'Benchmarked against similar videos'
                    )}
                  </div>
                  <div className="flex flex-col gap-[4px]">
                    {titleData.similarVideos.map((video, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-[8px] text-[12px] opacity-70"
                      >
                        <div className="flex-1 line-clamp-1" title={video.title}>
                          {video.title}
                        </div>
                        <div className="shrink-0">
                          {video.channelTitle} · {video.viewCount}{' '}
                          {t('views', 'views')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                secondary
                loading={titleLoading}
                onClick={() => generateTitles(true)}
              >
                {t('regenerate', 'Regenerate')}
              </Button>
            </>
          )}
        </div>
      )}

      {tab === 'seo' && (
        <div className="flex flex-col gap-[12px]">
          {!seoData && (
            <Button loading={seoLoading} onClick={() => generateSeo(false)}>
              {t('generate_seo_suggestions', 'Generate SEO suggestions')}
            </Button>
          )}
          {!!seoData && (
            <>
              <Textarea
                disableForm
                label={t('suggested_description', 'Suggested description')}
                name="description"
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                className="!min-h-[120px]"
              />
              <div className="flex flex-col gap-[6px]">
                <div className="text-[14px]">
                  {t('suggested_tags', 'Suggested tags')}
                </div>
                <div className="flex flex-wrap gap-[6px]">
                  {seoData.tags.map((tag) => (
                    <div
                      key={tag.tag}
                      title={`${t('relevance', 'Relevance')}: ${tag.relevance}`}
                      className="text-[12px] px-[8px] py-[4px] rounded-full bg-newTableBorder"
                    >
                      {tag.tag}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-[8px]">
                <Button loading={applyingSeo} onClick={applySeo}>
                  {t('apply_to_youtube', 'Apply to YouTube')}
                </Button>
                <Button
                  secondary
                  loading={seoLoading}
                  onClick={() => generateSeo(true)}
                >
                  {t('regenerate', 'Regenerate')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'thumbnail' && (
        <div className="flex flex-col gap-[12px]">
          <Input
            disableForm
            removeError
            label={t(
              'thumbnail_idea_optional',
              'Describe your thumbnail idea (optional)'
            )}
            name="thumbnailPrompt"
            placeholder={t(
              'thumbnail_idea_placeholder',
              'Leave blank to let AI decide based on the title'
            )}
            value={thumbnailPrompt}
            onChange={(e) => setThumbnailPrompt(e.target.value)}
          />
          <Button loading={thumbnailLoading} onClick={generateThumbnail}>
            {t('quick_generate', 'Quick Generate')}
          </Button>

          {!!thumbnailResult && (
            <>
              <div className="rounded-[8px] overflow-hidden aspect-video bg-fifth">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailResult.imageUrl}
                  alt={t('generated_thumbnail', 'Generated thumbnail')}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="text-[13px] opacity-70">
                {t('predicted_score', 'Predicted score')}:{' '}
                {thumbnailResult.feedback.score}/100
              </div>
              {!!thumbnailResult.feedback.pros.length && (
                <div className="flex flex-col gap-[4px]">
                  <div className="text-[13px] font-[500]">
                    {t('pros', 'Pros')}
                  </div>
                  <ul className="flex flex-col gap-[2px] text-[12px] opacity-80">
                    {thumbnailResult.feedback.pros.map((pro, index) => (
                      <li key={index}>• {pro}</li>
                    ))}
                  </ul>
                </div>
              )}
              {!!thumbnailResult.feedback.cons.length && (
                <div className="flex flex-col gap-[4px]">
                  <div className="text-[13px] font-[500]">
                    {t('cons', 'Cons')}
                  </div>
                  <ul className="flex flex-col gap-[2px] text-[12px] opacity-80">
                    {thumbnailResult.feedback.cons.map((con, index) => (
                      <li key={index}>• {con}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex gap-[8px]">
                <Button loading={applyingThumbnail} onClick={applyThumbnail}>
                  {t('use_this_thumbnail', 'Use this thumbnail')}
                </Button>
                <Button
                  secondary
                  loading={thumbnailLoading}
                  onClick={generateThumbnail}
                >
                  {t('generate_another', 'Generate another')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'comments' && (
        <div className="flex flex-col gap-[12px]">
          {commentsLoading && (
            <div className="text-[13px] opacity-60">
              {t('loading_comments', 'Loading comments...')}
            </div>
          )}
          {!commentsLoading && comments !== null && !remainingComments.length && (
            <div className="text-[13px] opacity-60">
              {t(
                'no_unanswered_comments',
                'No unanswered comments on this video.'
              )}
            </div>
          )}
          {!!currentComment && (
            <>
              <div className="text-[12px] opacity-60">
                {remainingComments.length}{' '}
                {t('unanswered_remaining', 'unanswered comment(s) remaining')}
              </div>
              <div className="flex flex-col gap-[8px] p-[10px] rounded-[8px] bg-newTableBorder">
                <div className="flex items-center gap-[8px]">
                  {currentComment.authorProfileImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentComment.authorProfileImageUrl}
                      alt={currentComment.authorDisplayName}
                      className="w-[28px] h-[28px] rounded-full"
                    />
                  )}
                  <div className="text-[13px] font-[500]">
                    {currentComment.authorDisplayName}
                  </div>
                </div>
                <div className="text-[13px] opacity-90">
                  {currentComment.text}
                </div>
              </div>

              <Textarea
                disableForm
                label={t('your_reply', 'Your reply')}
                name="replyDraft"
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                className="!min-h-[100px]"
              />
              <div className="text-[11px] opacity-60">
                {t(
                  'review_before_sending',
                  "Review the reply before sending - it's posted publicly as you."
                )}
              </div>

              <div className="flex gap-[8px]">
                <Button loading={draftLoading} secondary onClick={generateReply}>
                  {t('draft_reply_with_ai', 'Draft reply with AI')}
                </Button>
                <Button
                  loading={sendingReply}
                  disabled={!replyDraft.trim()}
                  onClick={sendReply}
                >
                  {t('send_reply', 'Send reply')}
                </Button>
                <div className="flex-1" />
                <Button secondary onClick={skipComment}>
                  {t('skip', 'Skip')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'review' && (
        <div className="flex flex-col gap-[12px]">
          <div className="rounded-[8px] overflow-hidden aspect-video bg-black">
            <iframe
              ref={playerRef}
              src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1`}
              className="w-full h-full"
              title={t('video_preview', 'Video preview')}
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>

          {!reviewResult && (
            <Button loading={reviewLoading} onClick={() => generateReview(false)}>
              {t('review_this_video', 'Review this video')}
            </Button>
          )}

          {!!reviewResult && !reviewResult.available && (
            <div className="text-[13px] opacity-70">
              {t(
                'no_captions_available',
                "Captions aren't available for this video yet, so it can't be reviewed."
              )}
            </div>
          )}

          {!!reviewResult && reviewResult.available && (
            <>
              <div className="text-[13px] opacity-70">
                {t('overall_score', 'Overall score')}:{' '}
                {reviewResult.review.overallScore}/100
              </div>
              <div className="text-[13px]">{reviewResult.review.summary}</div>
              <div className="text-[11px] opacity-60">
                {t(
                  'review_based_on_captions',
                  "Based on this video's captions - visual-only issues (lighting, on-screen text, b-roll) aren't covered yet."
                )}
              </div>

              <div className="flex flex-col gap-[14px] max-h-[320px] overflow-y-auto">
                {reviewResult.review.categories.map((category) => (
                  <div key={category.category} className="flex flex-col gap-[6px]">
                    <div className="text-[13px] font-[600]">
                      {CATEGORY_LABELS[category.category]}
                    </div>
                    {!category.items.length && (
                      <div className="text-[12px] opacity-50">
                        {t('nothing_notable', 'Nothing notable here.')}
                      </div>
                    )}
                    {category.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-[8px] p-[8px] rounded-[8px] bg-newTableBorder"
                      >
                        <div
                          className={clsx(
                            'w-[8px] h-[8px] rounded-full mt-[4px] shrink-0',
                            SEVERITY_COLOR[item.severity]
                          )}
                        />
                        <div className="flex flex-col gap-[2px]">
                          <div
                            className="text-[12px] font-[500] underline cursor-pointer w-fit"
                            onClick={() => seekTo(item.timestamp)}
                          >
                            {item.timestamp}
                          </div>
                          <div className="text-[12px] opacity-80">
                            {item.note}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <Button
                secondary
                loading={reviewLoading}
                onClick={() => generateReview(true)}
              >
                {t('regenerate', 'Regenerate')}
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button secondary onClick={closeCurrent}>
          {t('close', 'Close')}
        </Button>
      </div>
    </div>
  );
};
