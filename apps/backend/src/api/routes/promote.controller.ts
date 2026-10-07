import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Organization } from '@prisma/client';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';
import { AddCompetitorDto } from '@gitroom/nestjs-libraries/dtos/promote/add.competitor.dto';

@ApiTags('Promote')
@Controller('/promote')
export class PromoteController {
  constructor(private _promoteService: PromoteService) {}

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
}
