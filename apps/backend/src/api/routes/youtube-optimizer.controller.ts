import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { YoutubeOptimizerService } from '@gitroom/nestjs-libraries/youtube-optimizer/youtube.optimizer.service';
import { ApplyVideoMetadataDto } from '@gitroom/nestjs-libraries/dtos/youtube-optimizer/apply.video.metadata.dto';
import { GenerateThumbnailDto } from '@gitroom/nestjs-libraries/dtos/youtube-optimizer/generate.thumbnail.dto';
import { ApplyThumbnailDto } from '@gitroom/nestjs-libraries/dtos/youtube-optimizer/apply.thumbnail.dto';
import { DraftCommentReplyDto } from '@gitroom/nestjs-libraries/dtos/youtube-optimizer/draft.comment.reply.dto';
import { PostCommentReplyDto } from '@gitroom/nestjs-libraries/dtos/youtube-optimizer/post.comment.reply.dto';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import {
  AuthorizationActions,
  Sections,
} from '@gitroom/backend/services/auth/permissions/permission.exception.class';

@ApiTags('Youtube Optimizer')
@Controller('/youtube-optimizer')
export class YoutubeOptimizerController {
  constructor(private _youtubeOptimizerService: YoutubeOptimizerService) {}

  @Get('/:integrationId/videos/:videoId')
  getVideoDetails(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string
  ) {
    return this._youtubeOptimizerService.getVideoDetails(
      org,
      integrationId,
      videoId
    );
  }

  @Post('/:integrationId/videos/:videoId/title-suggestions')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  getTitleSuggestions(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Query('regenerate') regenerate: string
  ) {
    return this._youtubeOptimizerService.getTitleSuggestions(
      org,
      integrationId,
      videoId,
      regenerate === 'true'
    );
  }

  @Post('/:integrationId/videos/:videoId/seo-suggestions')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  getSeoSuggestions(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Query('regenerate') regenerate: string
  ) {
    return this._youtubeOptimizerService.getSeoSuggestions(
      org,
      integrationId,
      videoId,
      regenerate === 'true'
    );
  }

  @Post('/:integrationId/videos/:videoId/apply')
  applyVideoMetadata(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Body() body: ApplyVideoMetadataDto
  ) {
    return this._youtubeOptimizerService.applyVideoMetadata(
      org,
      integrationId,
      videoId,
      body
    );
  }

  @Post('/:integrationId/videos/:videoId/thumbnail')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  generateThumbnail(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Body() body: GenerateThumbnailDto
  ) {
    return this._youtubeOptimizerService.generateThumbnail(
      org,
      integrationId,
      videoId,
      body.prompt
    );
  }

  @Post('/:integrationId/videos/:videoId/apply-thumbnail')
  applyThumbnail(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Body() body: ApplyThumbnailDto
  ) {
    return this._youtubeOptimizerService.applyThumbnail(
      org,
      integrationId,
      videoId,
      body.imageUrl
    );
  }

  @Get('/:integrationId/videos/:videoId/comments')
  listUnansweredComments(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string
  ) {
    return this._youtubeOptimizerService.listUnansweredComments(
      org,
      integrationId,
      videoId
    );
  }

  @Post('/:integrationId/videos/:videoId/comments/:commentId/draft-reply')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  getCommentReplyDraft(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Param('commentId') commentId: string,
    @Query('regenerate') regenerate: string,
    @Body() body: DraftCommentReplyDto
  ) {
    return this._youtubeOptimizerService.getCommentReplyDraft(
      org,
      integrationId,
      videoId,
      commentId,
      body.commentText,
      regenerate === 'true'
    );
  }

  @Post('/:integrationId/videos/:videoId/comments/:commentId/reply')
  postCommentReply(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('commentId') commentId: string,
    @Body() body: PostCommentReplyDto
  ) {
    return this._youtubeOptimizerService.postCommentReply(
      org,
      integrationId,
      commentId,
      body.text
    );
  }

  @Post('/:integrationId/videos/:videoId/review')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  getVideoReview(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('videoId') videoId: string,
    @Query('regenerate') regenerate: string
  ) {
    return this._youtubeOptimizerService.getVideoReview(
      org,
      integrationId,
      videoId,
      regenerate === 'true'
    );
  }

  // Optimizer Phase 6: channel-home read-only endpoints. Neither is
  // AI-gated - overview is a plain stats read, and the insights feed only
  // ever surfaces already-cached suggestions plus free comment reads (see
  // YoutubeOptimizerService.getInsightsFeed), never new generation.
  @Get('/:integrationId/overview')
  getChannelOverview(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string
  ) {
    return this._youtubeOptimizerService.getChannelOverview(
      org,
      integrationId
    );
  }

  @Get('/:integrationId/insights')
  getInsightsFeed(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string
  ) {
    return this._youtubeOptimizerService.getInsightsFeed(org, integrationId);
  }

  // Optimizer Phase 7: called by the Feed page itself on load, not a
  // user-initiated "Generate" click - deliberately NOT behind the AI
  // CheckPolicies guard the other suggestion endpoints use, since a 403 here
  // for a zero-credit org must not surface as a page error. Credit checks
  // still happen inside the service (via the same getTitleSuggestions/
  // getSeoSuggestions calls Optimize itself uses) - they just fail
  // silently here instead of showing the user an error toast.
  @Post('/:integrationId/auto-populate')
  autoPopulateFeed(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string
  ) {
    return this._youtubeOptimizerService.autoPopulateFeed(org, integrationId);
  }

  @Post('/:integrationId/insights/:insightId/dismiss')
  dismissInsight(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('insightId') insightId: string
  ) {
    return this._youtubeOptimizerService.dismissInsight(
      org,
      integrationId,
      insightId
    );
  }
}
