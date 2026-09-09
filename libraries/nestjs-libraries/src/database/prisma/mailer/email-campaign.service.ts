import { Injectable, Logger } from '@nestjs/common';
import { EmailCampaignRepository } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-campaign.repository';
import { EmailGroupService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-group.service';
import { EmailCampaignDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-campaign.dto';
import { EmailService } from '@gitroom/nestjs-libraries/services/email.service';
import { EmailSuppressionService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-suppression.service';

// Batches how many recipients we hand to EmailService.sendEmail() at once.
// Each call only *signals* the existing durable sendEmailWorkflow Temporal
// queue (see email.service.ts) rather than blocking on real SMTP delivery,
// so this is about not opening hundreds of concurrent Temporal client
// calls at once, not about email-provider rate limits (Temporal's queue
// already serializes the actual sends).
const DISPATCH_BATCH_SIZE = 25;

@Injectable()
export class EmailCampaignService {
  private readonly _logger = new Logger(EmailCampaignService.name);

  constructor(
    private _emailCampaignRepository: EmailCampaignRepository,
    private _emailGroupService: EmailGroupService,
    private _emailService: EmailService,
    private _emailSuppressionService: EmailSuppressionService
  ) {}

  list() {
    return this._emailCampaignRepository.list();
  }

  getById(id: string) {
    return this._emailCampaignRepository.getById(id);
  }

  create(body: EmailCampaignDto) {
    return this._emailCampaignRepository.create(body);
  }

  update(id: string, body: Partial<EmailCampaignDto>) {
    return this._emailCampaignRepository.update(id, body);
  }

  delete(id: string) {
    return this._emailCampaignRepository.delete(id);
  }

  listLogs(campaignId: string) {
    return this._emailCampaignRepository.listLogs(campaignId);
  }

  // Sends immediately. Recipient dispatch (deciding who to send to and
  // firing each signal) runs right here rather than as its own durable
  // orchestrator workflow - the actual delivery is still durable, because
  // each recipient goes through the existing sendEmailWorkflow Temporal
  // queue (see EmailService.sendEmail's signalWithStart), which survives
  // an API-process restart mid-loop. What is NOT yet resumable is the
  // dispatch loop itself: a crash mid-campaign can leave some recipients
  // un-dispatched, and the campaign would need to be re-sent (already-sent
  // recipients are safe to re-send to only if you're fine with a possible
  // duplicate - there is no dispatch-level idempotency key yet). Wrapping
  // this loop in its own orchestrator workflow+activity is the natural
  // next step for very large campaigns.
  async sendNow(id: string) {
    const campaign = await this._emailCampaignRepository.getById(id);
    if (!campaign) throw new Error('Campaign not found');

    const recipients = await this._emailGroupService.resolveMembers(
      campaign.groupId
    );

    await this._emailCampaignRepository.markSending(id, recipients.length);

    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i += DISPATCH_BATCH_SIZE) {
      const batch = recipients.slice(i, i + DISPATCH_BATCH_SIZE);
      await Promise.all(
        batch.map(async (recipient) => {
          const log = await this._emailCampaignRepository.createLog(
            id,
            recipient.email,
            recipient.userId
          );
          try {
            const unsubscribeUrl = this._emailSuppressionService.buildUnsubscribeUrl(
              recipient.email
            );
            const html = `${campaign.htmlContent}<p style="text-align:center;font-size:12px;color:#8A8B96;margin-top:24px;"><a href="${unsubscribeUrl}" style="color:#8A8B96;">Unsubscribe</a></p>`;
            await this._emailService.sendEmail(
              recipient.email,
              campaign.subject,
              html,
              'bottom'
            );
            await this._emailCampaignRepository.markLogSent(log.id);
            sentCount += 1;
          } catch (err) {
            this._logger.error(
              `Mailer campaign ${id} failed for ${recipient.email}`,
              err as Error
            );
            await this._emailCampaignRepository.markLogFailed(
              log.id,
              (err as Error)?.message || 'Unknown error'
            );
            failedCount += 1;
          }
        })
      );
    }

    await this._emailCampaignRepository.markSent(id, sentCount, failedCount);
    return { totalRecipients: recipients.length, sentCount, failedCount };
  }
}
