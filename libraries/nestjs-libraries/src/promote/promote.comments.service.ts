import { HttpException, Injectable } from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';
import { OpenaiService } from '@gitroom/nestjs-libraries/openai/openai.service';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { PromoteCommentPost } from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { generationError } from '@gitroom/nestjs-libraries/openai/generation.error';
import {
  AuthorizationActions,
  Sections,
  SubscriptionException,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

const INBOX_CACHE_SECONDS = 120;
const MAX_POSTS = 10;
// Safety valve so a stuck click or a script can't mass-reply from one
// account: Instagram flags that pattern, and so do we.
const MAX_REPLIES_PER_HOUR = 40;
const AI_CREDIT_TYPE = 'youtube_text_suggestions';

@Injectable()
export class PromoteCommentsService {
  constructor(
    private _promoteService: PromoteService,
    private _openai: OpenaiService,
    private _subscriptionService: SubscriptionService
  ) {}

  private cacheKey(integrationId: string) {
    return `promote:comments:${integrationId}`;
  }

  private mapError(e: any): never {
    const msg = String(e?.message || '');
    if (msg === 'NO_COMMENT_PERMISSION') {
      throw new HttpException(
        'Instagram did not allow comment access. Reconnect the account and accept the comments permission.',
        403
      );
    }
    return this._promoteService.toHttp(e);
  }

  private async load(
    org: Organization,
    integrationId: string,
    refresh: boolean
  ) {
    const { integration, provider } = await this._promoteService.requireAccount(
      org,
      integrationId
    );
    if (!provider.promoteListComments || !provider.promoteReplyToComment) {
      throw new HttpException('Comment tools are not available.', 400);
    }

    if (!refresh) {
      try {
        const cached = await ioRedis.get(this.cacheKey(integration.id));
        if (cached) {
          return { integration, provider, posts: JSON.parse(cached) as PromoteCommentPost[] };
        }
      } catch (e) {}
    }

    let posts: PromoteCommentPost[];
    try {
      posts = await provider.promoteListComments(
        integration.token,
        integration.internalId,
        integration.profile || null,
        MAX_POSTS
      );
    } catch (e) {
      this.mapError(e);
    }
    try {
      await ioRedis.set(
        this.cacheKey(integration.id),
        JSON.stringify(posts),
        'EX',
        INBOX_CACHE_SECONDS
      );
    } catch (e) {}
    return { integration, provider, posts };
  }

  async inbox(org: Organization, integrationId: string, refresh = false) {
    const { posts } = await this.load(org, integrationId, refresh);
    let unanswered = 0;
    const out = posts.map((p) => {
      const comments = [...p.comments]
        .map((c) => ({ ...c, needsReply: !c.own && !c.replied }))
        .sort((a, b) => Number(b.needsReply) - Number(a.needsReply));
      unanswered += comments.filter((c) => c.needsReply).length;
      return { media: p.media, comments };
    });
    return { unanswered, posts: out };
  }

  private findComment(posts: PromoteCommentPost[], commentId: string) {
    for (const p of posts) {
      const comment = p.comments.find((c) => c.id === commentId);
      if (comment) {
        return { post: p, comment };
      }
    }
    return null;
  }

  // AI draft. Consumes a text-suggestion credit; the draft is returned to the
  // person to edit and send themselves.
  async draft(
    org: Organization,
    integrationId: string,
    commentId: string,
    tone: 'friendly' | 'professional' | 'playful' = 'friendly'
  ) {
    const { posts } = await this.load(org, integrationId, false);
    const found = this.findComment(posts, commentId);
    if (!found) {
      throw new HttpException(
        'Comment not found. Refresh the inbox and try again.',
        404
      );
    }

    const totalCredits = await this._subscriptionService.checkCredits(
      org,
      AI_CREDIT_TYPE
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
        AI_CREDIT_TYPE,
        () =>
          this._openai.generateInstagramCommentReply(
            found.comment.text,
            found.post.media.caption || '',
            tone
          )
      );
    } catch (err) {
      throw generationError(err);
    }
  }

  async reply(
    org: Organization,
    integrationId: string,
    commentId: string,
    message: string
  ) {
    const text = message.trim();
    if (!text) {
      throw new HttpException('Write a reply first.', 400);
    }
    // Instagram rejects replies with more than 4 hashtags.
    if ((text.match(/#[\p{L}\p{N}_]+/gu) || []).length > 4) {
      throw new HttpException('Instagram allows at most 4 hashtags in a reply.', 400);
    }

    const { integration, provider, posts } = await this.load(
      org,
      integrationId,
      true
    );
    const found = this.findComment(posts, commentId);
    if (!found) {
      throw new HttpException(
        'Comment not found on your recent posts. It may have been deleted.',
        404
      );
    }
    if (found.comment.own) {
      throw new HttpException('That comment is from your own account.', 400);
    }
    if (found.comment.replied) {
      throw new HttpException('You have already replied to this comment.', 400);
    }

    const bucket = `promote:reply-count:${integration.id}:${Math.floor(Date.now() / 3600000)}`;
    const count = await ioRedis.incr(bucket);
    if (count === 1) {
      await ioRedis.expire(bucket, 3600);
    }
    if (count > MAX_REPLIES_PER_HOUR) {
      throw new HttpException(
        `Reply limit reached (${MAX_REPLIES_PER_HOUR} per hour). Try again later.`,
        429
      );
    }

    try {
      const res = await provider.promoteReplyToComment!(integration.token, commentId, text);
      await ioRedis.del(this.cacheKey(integration.id));
      return { id: res.id };
    } catch (e) {
      this.mapError(e);
    }
  }
}
