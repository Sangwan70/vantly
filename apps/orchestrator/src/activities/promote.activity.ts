import { Injectable } from '@nestjs/common';
import { Activity, ActivityMethod } from 'nestjs-temporal-core';
import { PromoteService } from '@gitroom/nestjs-libraries/promote/promote.service';

@Injectable()
@Activity()
export class PromoteActivity {
  constructor(private _promoteService: PromoteService) {}

  // Resolves false once the competitor or its account is gone, which tells
  // promoteSyncWorkflow to stop.
  @ActivityMethod()
  async syncCompetitor(competitorId: string): Promise<boolean> {
    return this._promoteService.syncCompetitorById(competitorId);
  }
}
