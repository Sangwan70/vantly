import { Injectable } from '@nestjs/common';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import {
  OpenaiService,
  YoutubeCommentReplyDraft,
  YoutubeSeoSuggestions,
  YoutubeThumbnailFeedback,
  YoutubeTitleSuggestions,
  YoutubeVideoReview,
} from '@gitroom/nestjs-libraries/openai/openai.service';
import {
  SimilarVideo,
  VideoComment,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { Organization } from '@prisma/client';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { generationError } from '@gitroom/nestjs-libraries/openai/generation.error';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

// AI suggestions don't need to be regenerated on every page load - cached in
// Redis (same mechanism checkAnalytics already uses) rather than a new table,
// so Phase 2 stays migration-free like Phase 1. "Regenerate" bypasses this
// and burns a fresh credit; opening the tab again does not.
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;

// Optimizer Phase 5: caps how much transcript text gets sent to the LLM per
// review. ~40k characters is comfortably within gpt-4.1's context window
// alongside the rest of the prompt, while keeping a single review call's
// cost bounded regardless of video length - a multi-hour video's transcript
// gets truncated rather than blowing up the prompt size or the bill.
const MAX_TRANSCRIPT_CHARS = 40000;

// Optimizer Phase 6: search.list is 100 quota units (vs 1 for the reads
// elsewhere in this feature - see YOUTUBE_OPTIMIZER_PLAN.md section 5), so
// benchmark results are cached far longer than suggestion data and keyed on
// the search query itself rather than per-integration - "similar videos for
// this topic" is public data, reusable across any org searching the same
// topic, not something tied to one channel's credentials.
const SIMILAR_VIDEOS_CACHE_TTL_SECONDS = 60 * 60 * 24;

// Channel totals for the milestone bars change slowly - an hour of staleness
// is an easy trade for not spending a channels.list call on every page load.
const CHANNEL_OVERVIEW_CACHE_TTL_SECONDS = 60 * 60;

// How many of the channel's most recent videos the insights feed inspects
// per load. Bounded deliberately: title/SEO cards are a cheap Redis GET per
// video so this list can be generous, but it also gates the (quota-costlier)
// comment scan below.
const INSIGHTS_VIDEO_SCAN_LIMIT = 10;

// Of the scanned videos, how many get an actual commentThreads.list call for
// the "unanswered comment" insight card. Kept small and separate from
// INSIGHTS_VIDEO_SCAN_LIMIT since this is a real YouTube API call per video,
// not a cache lookup - scanning all 10 on every feed load would be wasteful.
const INSIGHTS_COMMENT_VIDEO_LIMIT = 3;

// Dismissing an insight card is a Redis SET member, not a DB row (staying
// migration-free like every other phase) - it expires after 90 days rather
// than living forever, so the underlying Redis key can't grow unbounded.
// Trade-off: a comment dismissed more than 90 days ago and still unanswered
// could resurface in the feed - accepted as a rare edge case rather than
// standing up a permanent table for it.
const DISMISSED_INSIGHT_TTL_SECONDS = 60 * 60 * 24 * 90;

type InsightCard = {
  id: string;
  type: 'title' | 'seo' | 'comment';
  videoId: string;
  videoTitle: string;
  videoThumbnail: string;
  message: string;
};

// 1-2-5-10-20-50-100... progression, same shape vidIQ/most "progress to next
// milestone" UIs use - round, meaningful numbers rather than an arbitrary
// "next thousand".
const nextMilestone = (value: number): number => {
  let base = 100;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    for (const step of [1, 2, 5]) {
      const candidate = base * step;
      if (candidate > value) {
        return candidate;
      }
    }
    base *= 10;
  }
};

@Injectable()
export class YoutubeOptimizerService {
  private storage = UploadFactory.createStorage();

  constructor(
    private _integrationService: IntegrationService,
    private _openAi: OpenaiService,
    private _subscriptionService: SubscriptionService,
    private _mediaService: MediaService
  ) {}

  private async getVideo(
    org: Organization,
    integrationId: string,
    videoId: string
  ) {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.getVideoDetails) {
      throw new Error('This integration does not support video optimization');
    }

    const video = await found.provider.getVideoDetails(
      found.integration.token,
      videoId
    );

    if (!video) {
      throw new Error('Video not found');
    }

    return { integration: found.integration, provider: found.provider, video };
  }

  async getVideoDetails(
    org: Organization,
    integrationId: string,
    videoId: string
  ) {
    const { video } = await this.getVideo(org, integrationId, videoId);
    return video;
  }

  private async checkAndConsumeCredit<T>(
    org: Organization,
    func: () => Promise<T>
  ): Promise<T> {
    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      'youtube_text_suggestions'
    );

    if (totalCredits.credits <= 0) {
      throw new SubscriptionException({
        action: AuthorizationActions.Create,
        section: Sections.AI,
      });
    }

    try {
      return await this._subscriptionService.useCredit(
        org,
        'youtube_text_suggestions',
        func
      );
    } catch (err) {
      throw generationError(err);
    }
  }

  // Optimizer Phase 6: best-effort fetch of real similar videos to benchmark
  // the title suggestions against (feature inventory item 6). Failures here
  // never block title generation - a provider without search support, a
  // quota error, or an empty result just falls back to Phase 2's original
  // ungrounded behavior.
  private async getSimilarVideosForBenchmark(
    provider: { searchSimilarVideos?: any },
    accessToken: string,
    query: string,
    excludeChannelId: string
  ): Promise<SimilarVideo[]> {
    if (!provider.searchSimilarVideos) {
      return [];
    }

    const cacheKey = `youtube-optimizer:similar:${query
      .toLowerCase()
      .trim()
      .slice(0, 200)}`;

    const cached = await ioRedis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      const similar = await provider.searchSimilarVideos(
        accessToken,
        query,
        excludeChannelId
      );

      await ioRedis.set(
        cacheKey,
        JSON.stringify(similar),
        'EX',
        SIMILAR_VIDEOS_CACHE_TTL_SECONDS
      );

      return similar;
    } catch (err) {
      console.error('Failed to fetch similar videos for benchmarking:', err);
      return [];
    }
  }

  async getTitleSuggestions(
    org: Organization,
    integrationId: string,
    videoId: string,
    regenerate = false
  ): Promise<YoutubeTitleSuggestions & { similarVideos: SimilarVideo[] }> {
    const cacheKey = `youtube-optimizer:title:${integrationId}:${videoId}`;

    if (!regenerate) {
      const cached = await ioRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const { provider, integration, video } = await this.getVideo(
      org,
      integrationId,
      videoId
    );

    const similarVideos = await this.getSimilarVideosForBenchmark(
      provider,
      integration.token,
      video.title,
      integration.internalId
    );

    const suggestions = await this.checkAndConsumeCredit(org, () =>
      this._openAi.generateYoutubeTitleSuggestions(
        video.title,
        video.description,
        video.tags,
        similarVideos
      )
    );

    const result = { ...suggestions, similarVideos };

    await ioRedis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS
    );

    return result;
  }

  async getSeoSuggestions(
    org: Organization,
    integrationId: string,
    videoId: string,
    regenerate = false
  ): Promise<YoutubeSeoSuggestions> {
    const cacheKey = `youtube-optimizer:seo:${integrationId}:${videoId}`;

    if (!regenerate) {
      const cached = await ioRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const { video } = await this.getVideo(org, integrationId, videoId);

    const suggestions = await this.checkAndConsumeCredit(org, () =>
      this._openAi.generateYoutubeSeoSuggestions(
        video.title,
        video.description,
        video.tags
      )
    );

    await ioRedis.set(
      cacheKey,
      JSON.stringify(suggestions),
      'EX',
      CACHE_TTL_SECONDS
    );

    return suggestions;
  }

  // Optimizer Phase 3: "Quick Generate" - unlike title/SEO, each click is a
  // deliberate paid image generation (no cache/regenerate distinction), so
  // this reuses MediaService.generateImage() directly - it already meters
  // against the existing 'ai_images' pool and normalizes generation errors,
  // so there's no need for a new credit type or a second checkCredits call
  // here (see pricing.ts's youtube_text_suggestions comment: image work
  // stays on the image pool, text suggestions get their own).
  async generateThumbnail(
    org: Organization,
    integrationId: string,
    videoId: string,
    prompt?: string
  ): Promise<{ imageUrl: string; feedback: YoutubeThumbnailFeedback }> {
    const { video } = await this.getVideo(org, integrationId, videoId);

    const finalPrompt =
      prompt?.trim() ||
      `A high click-through-rate YouTube thumbnail for a video titled "${video.title}". Bold, high-contrast, readable at small sizes, no long blocks of text.`;

    try {
      const base64 = await this._mediaService.generateImage(finalPrompt, org);
      const dataUrl = `data:image/png;base64,${base64}`;

      const uploadedPath = await this.storage.uploadSimple(dataUrl);
      const saved = await this._mediaService.saveFile(
        org.id,
        uploadedPath.split('/').pop()!,
        uploadedPath
      );

      const feedback = await this._openAi.generateYoutubeThumbnailFeedback(
        dataUrl,
        video.title,
        video.description
      );

      return { imageUrl: saved.path, feedback };
    } catch (err) {
      throw generationError(err);
    }
  }

  async applyThumbnail(
    org: Organization,
    integrationId: string,
    videoId: string,
    imageUrl: string
  ) {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.setVideoThumbnail) {
      throw new Error('This integration does not support setting a thumbnail');
    }

    return found.provider.setVideoThumbnail(
      found.integration.token,
      videoId,
      imageUrl
    );
  }

  async applyVideoMetadata(
    org: Organization,
    integrationId: string,
    videoId: string,
    data: { title?: string; description?: string; tags?: string[] }
  ) {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.updateVideoMetadata) {
      throw new Error('This integration does not support editing videos');
    }

    const result = await found.provider.updateVideoMetadata(
      found.integration.token,
      videoId,
      data
    );

    // The applied metadata invalidates any cached suggestions generated
    // against the old title/description/tags - clear both so the next open
    // regenerates against the now-current video instead of showing stale
    // suggestions/"current score" for content that's already changed.
    await Promise.all([
      ioRedis.del(`youtube-optimizer:title:${integrationId}:${videoId}`),
      ioRedis.del(`youtube-optimizer:seo:${integrationId}:${videoId}`),
      ioRedis.del(`youtube-optimizer:review:${integrationId}:${videoId}`),
    ]);

    return result;
  }

  // Optimizer Phase 4: the channel's own id (getIntegration.internalId) is
  // what listComments compares each reply's authorChannelId against to
  // decide "has the channel owner already replied" - the filtering itself
  // happens here, not in the provider, so listComments stays a plain read.
  async listUnansweredComments(
    org: Organization,
    integrationId: string,
    videoId: string
  ): Promise<VideoComment[]> {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.listComments) {
      return [];
    }

    const comments = await found.provider.listComments(
      found.integration.token,
      videoId,
      found.integration.internalId
    );

    return comments.filter((comment) => !comment.hasChannelOwnerReply);
  }

  async getCommentReplyDraft(
    org: Organization,
    integrationId: string,
    videoId: string,
    commentId: string,
    commentText: string,
    regenerate = false
  ): Promise<YoutubeCommentReplyDraft> {
    const cacheKey = `youtube-optimizer:comment-reply:${commentId}`;

    if (!regenerate) {
      const cached = await ioRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const { video } = await this.getVideo(org, integrationId, videoId);

    const draft = await this.checkAndConsumeCredit(org, () =>
      this._openAi.generateYoutubeCommentReply(commentText, video.title)
    );

    await ioRedis.set(
      cacheKey,
      JSON.stringify(draft),
      'EX',
      CACHE_TTL_SECONDS
    );

    return draft;
  }

  async postCommentReply(
    org: Organization,
    integrationId: string,
    commentId: string,
    text: string
  ) {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.replyToComment) {
      throw new Error(
        'This integration does not support replying to comments'
      );
    }

    const result = await found.provider.replyToComment(
      found.integration.token,
      commentId,
      text
    );

    await ioRedis.del(`youtube-optimizer:comment-reply:${commentId}`);

    return result;
  }

  // Optimizer Phase 5 (Review tab, v1 scope per plan 3d): captions-only
  // critique. Returns `{ available: false }` rather than throwing when the
  // provider doesn't support transcripts or the video simply has no caption
  // track - both are real, expected states the Review tab must render
  // (e.g. "captions aren't available for this video yet"), not errors.
  async getVideoReview(
    org: Organization,
    integrationId: string,
    videoId: string,
    regenerate = false
  ): Promise<
    | { available: true; review: YoutubeVideoReview }
    | { available: false; reason: 'no_captions' }
  > {
    const cacheKey = `youtube-optimizer:review:${integrationId}:${videoId}`;

    if (!regenerate) {
      const cached = await ioRedis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const { provider, integration, video } = await this.getVideo(
      org,
      integrationId,
      videoId
    );

    if (!provider.getTranscript) {
      return { available: false, reason: 'no_captions' };
    }

    const transcriptResult = await provider.getTranscript(
      integration.token,
      videoId
    );

    if (!transcriptResult) {
      return { available: false, reason: 'no_captions' };
    }

    const transcript =
      transcriptResult.transcript.length > MAX_TRANSCRIPT_CHARS
        ? `${transcriptResult.transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n[transcript truncated - this video is longer than what was analyzed]`
        : transcriptResult.transcript;

    const review = await this.checkAndConsumeCredit(org, () =>
      this._openAi.generateYoutubeVideoReview(
        transcript,
        video.title,
        video.description
      )
    );

    const result = { available: true as const, review };

    await ioRedis.set(
      cacheKey,
      JSON.stringify(result),
      'EX',
      CACHE_TTL_SECONDS
    );

    return result;
  }

  // Optimizer Phase 6: subscriber/view totals + "progress to next milestone"
  // for the channel-home progress bars. Returns undefined (not a throw) if
  // the provider doesn't support channel stats, or the lookup fails - the
  // frontend just omits the bars rather than erroring the whole page.
  async getChannelOverview(org: Organization, integrationId: string) {
    const cacheKey = `youtube-optimizer:overview:${integrationId}`;
    const cached = await ioRedis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.getChannelStats) {
      return undefined;
    }

    const stats = await found.provider.getChannelStats(
      found.integration.token,
      found.integration.internalId
    );

    if (!stats) {
      return undefined;
    }

    const subscriberMilestone = nextMilestone(stats.subscriberCount);
    const viewMilestone = nextMilestone(stats.viewCount);

    const overview = {
      subscriberCount: stats.subscriberCount,
      subscriberMilestone,
      subscriberProgress: Math.min(
        1,
        stats.subscriberCount / subscriberMilestone
      ),
      viewCount: stats.viewCount,
      viewMilestone,
      viewProgress: Math.min(1, stats.viewCount / viewMilestone),
      videoCount: stats.videoCount,
    };

    await ioRedis.set(
      cacheKey,
      JSON.stringify(overview),
      'EX',
      CHANNEL_OVERVIEW_CACHE_TTL_SECONDS
    );

    return overview;
  }

  // Optimizer Phase 6: the proactive "Insights feed" (feature inventory item
  // 1) - dismissible cards surfaced WITHOUT spending any AI credits just
  // from loading the page. Title/SEO cards only appear for suggestions the
  // user already generated (and hasn't applied) in that video's optimizer -
  // this deliberately does NOT auto-generate suggestions for every video in
  // the background, since that would silently spend credits the user never
  // asked to spend. Comment cards are a free read, bounded to a handful of
  // the most recent videos to control YouTube API quota.
  async getInsightsFeed(
    org: Organization,
    integrationId: string
  ): Promise<InsightCard[]> {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found || !found.provider.listVideos) {
      return [];
    }

    const dismissedKey = `youtube-optimizer:dismissed:${integrationId}`;

    const [dismissed, videoList] = await Promise.all([
      ioRedis.smembers(dismissedKey),
      found.provider.listVideos(
        found.integration.token,
        found.integration.internalId
      ),
    ]);

    const dismissedSet = new Set(dismissed);
    const recentVideos = videoList.videos.slice(0, INSIGHTS_VIDEO_SCAN_LIMIT);

    const suggestionCards = (
      await Promise.all(
        recentVideos.map(async (video): Promise<InsightCard[]> => {
          const [titleCached, seoCached] = await Promise.all([
            ioRedis.get(`youtube-optimizer:title:${integrationId}:${video.id}`),
            ioRedis.get(`youtube-optimizer:seo:${integrationId}:${video.id}`),
          ]);

          const cardsForVideo: InsightCard[] = [];

          if (titleCached) {
            const id = `title:${video.id}`;
            if (!dismissedSet.has(id)) {
              const parsed: YoutubeTitleSuggestions = JSON.parse(titleCached);
              const top = parsed.suggestions?.[0];
              if (top) {
                cardsForVideo.push({
                  id,
                  type: 'title',
                  videoId: video.id,
                  videoTitle: video.title,
                  videoThumbnail: video.thumbnail,
                  message: `A better title is ready: "${top.title}" (predicted ${top.predictedScore}/100 vs current ${parsed.currentScore}/100)`,
                });
              }
            }
          }

          if (seoCached) {
            const id = `seo:${video.id}`;
            if (!dismissedSet.has(id)) {
              cardsForVideo.push({
                id,
                type: 'seo',
                videoId: video.id,
                videoTitle: video.title,
                videoThumbnail: video.thumbnail,
                message:
                  'An improved description and tag list is ready to apply',
              });
            }
          }

          return cardsForVideo;
        })
      )
    ).flat();

    const cards: InsightCard[] = [...suggestionCards];

    if (found.provider.listComments) {
      const provider = found.provider;
      const commentCandidates = recentVideos
        .filter((video) => Number(video.commentCount || '0') > 0)
        .slice(0, INSIGHTS_COMMENT_VIDEO_LIMIT);

      const commentCards = (
        await Promise.all(
          commentCandidates.map(async (video): Promise<InsightCard | null> => {
            const comments = await provider.listComments!(
              found.integration.token,
              video.id,
              found.integration.internalId
            );
            const unanswered = comments.find((c) => !c.hasChannelOwnerReply);
            if (!unanswered) {
              return null;
            }

            const id = `comment:${video.id}:${unanswered.id}`;
            if (dismissedSet.has(id)) {
              return null;
            }

            return {
              id,
              type: 'comment',
              videoId: video.id,
              videoTitle: video.title,
              videoThumbnail: video.thumbnail,
              message: `${unanswered.authorDisplayName}: "${unanswered.text.slice(
                0,
                120
              )}"`,
            };
          })
        )
      ).filter((card): card is InsightCard => !!card);

      cards.push(...commentCards);
    }

    return cards;
  }

  async dismissInsight(
    org: Organization,
    integrationId: string,
    insightId: string
  ) {
    const found =
      await this._integrationService.getValidIntegrationAndProvider(
        org,
        integrationId
      );

    if (!found) {
      throw new Error('Integration not found');
    }

    const dismissedKey = `youtube-optimizer:dismissed:${integrationId}`;
    await ioRedis.sadd(dismissedKey, insightId);
    await ioRedis.expire(dismissedKey, DISMISSED_INSIGHT_TTL_SECONDS);

    return { success: true };
  }
}
