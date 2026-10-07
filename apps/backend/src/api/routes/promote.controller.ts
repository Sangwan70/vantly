import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';
import { PromoteInsightsService } from '@gitroom/nestjs-libraries/promote/promote.insights.service';
import { AddCompetitorDto } from '@gitroom/nestjs-libraries/dtos/promote/add.competitor.dto';

@ApiTags('Promote')
@Controller('/promote')
export class PromoteController {
  constructor(
    private _promoteService: PromoteService,
    private _insightsService: PromoteInsightsService
  ) {}

  // Instagram accounts of the current org, flagged eligible or not.
  @Get('/accounts')
  accounts(@GetOrgFromRequest() org: Organization) {
    return this._promoteService.accounts(org);
  }

  @Get('/:integrationId/competitors')
  overview(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string
  ) {
    return this._promoteService.overview(org, integrationId);
  }

  @Post('/:integrationId/competitors')
  addCompetitor(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Body() body: AddCompetitorDto
  ) {
    return this._promoteService.addCompetitor(org, integrationId, body.username);
  }

  @Post('/:integrationId/competitors/:id/refresh')
  refreshCompetitor(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('id') id: string
  ) {
    return this._promoteService.refreshCompetitor(org, integrationId, id);
  }

  @Delete('/:integrationId/competitors/:id')
  removeCompetitor(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Param('id') id: string
  ) {
    return this._promoteService.removeCompetitor(org, integrationId, id);
  }

  // Best times to post, format performance and posting cadence. `offset` is
  // the viewer's UTC offset in minutes so the heatmap is in local time.
  @Get('/:integrationId/insights')
  insights(
    @GetOrgFromRequest() org: Organization,
    @Param('integrationId') integrationId: string,
    @Query('offset') offset?: string
  ) {
    return this._insightsService.get(org, integrationId, parseInt(offset || '0', 10) || 0);
  }
}
