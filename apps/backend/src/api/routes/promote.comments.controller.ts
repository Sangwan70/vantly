import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PromoteCommentsService } from '@gitroom/nestjs-libraries/promote/promote.comments.service';
import {
  DraftCommentReplyDto,
  SendCommentReplyDto,
} from '@gitroom/nestjs-libraries/dtos/promote/comment.dto';

@ApiTags('Promote Comments')
@Controller('/promote/comments')
export class PromoteCommentsController {
  constructor(private _comments: PromoteCommentsService) {}

  @Get('/:integrationId')
  inbox(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Query('refresh') refresh?: string
  ) {
    return this._comments.inbox(org, integrationId, refresh === 'true');
  }

  // AI draft only: nothing is posted to Instagram by this call.
  @Post('/:integrationId/draft')
  draft(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Body() body: DraftCommentReplyDto
  ) {
    return this._comments.draft(org, integrationId, body.commentId, body.tone);
  }

  // Posts one reply, written or approved by the user.
  @Post('/:integrationId/reply')
  reply(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Body() body: SendCommentReplyDto
  ) {
    return this._comments.reply(org, integrationId, body.commentId, body.message);
  }
}
