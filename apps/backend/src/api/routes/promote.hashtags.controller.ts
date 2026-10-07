import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PromoteHashtagService } from '@gitroom/nestjs-libraries/promote/promote.hashtag.service';
import {
  ResearchHashtagDto,
  SaveHashtagSetDto,
  SuggestHashtagsDto,
} from '@gitroom/nestjs-libraries/dtos/promote/hashtag.dto';

@ApiTags('Promote Hashtags')
@Controller('/promote/hashtags')
export class PromoteHashtagsController {
  constructor(private _hashtags: PromoteHashtagService) {}

  @Post('/suggest')
  suggest(@GetOrgFromRequest() org: Organization, @Body() body: SuggestHashtagsDto) {
    return this._hashtags.suggest(org, body.topic);
  }

  @Get('/sets')
  sets(@GetOrgFromRequest() org: Organization) {
    return this._hashtags.sets(org);
  }

  @Post('/sets')
  saveSet(@GetOrgFromRequest() org: Organization, @Body() body: SaveHashtagSetDto) {
    return this._hashtags.saveSet(org, body.name, body.hashtags);
  }

  @Delete('/sets/:id')
  deleteSet(@GetOrgFromRequest() org: Organization, @Param('id') id: string) {
    return this._hashtags.deleteSet(org, id);
  }

  @Get('/:integrationId/quota')
  quota(@GetOrgFromRequest() org: Organization, @Param('integrationId') integrationId: string) {
    return this._hashtags.quota(org, integrationId);
  }

  @Get('/:integrationId/history')
  history(@GetOrgFromRequest() org: Organization, @Param('integrationId') integrationId: string) {
    return this._hashtags.history(org, integrationId);
  }

  @Post('/:integrationId/research')
  research(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Body() body: ResearchHashtagDto
  ) {
    return this._hashtags.research(org, integrationId, body.hashtag, !!body.refresh);
  }
}
