import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { EmailCampaignDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-campaign.dto';
import { EmailCampaignStatus, EmailLogStatus } from '@prisma/client';

@Injectable()
export class EmailCampaignRepository {
  constructor(
    private _campaign: PrismaRepository<'emailCampaign'>,
    private _log: PrismaRepository<'emailLog'>
  ) {}

  list() {
    return this._campaign.model.emailCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { group: { select: { name: true } } },
    });
  }

  getById(id: string) {
    return this._campaign.model.emailCampaign.findUnique({
      where: { id },
      include: { group: true, logs: false },
    });
  }

  create(body: EmailCampaignDto) {
    return this._campaign.model.emailCampaign.create({
      data: {
        name: body.name,
        subject: body.subject,
        templateId: body.templateId,
        groupId: body.groupId,
        htmlContent: body.htmlContent,
        status: body.scheduledFor
          ? EmailCampaignStatus.SCHEDULED
          : EmailCampaignStatus.DRAFT,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      },
    });
  }

  update(id: string, body: Partial<EmailCampaignDto>) {
    return this._campaign.model.emailCampaign.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.templateId !== undefined
          ? { templateId: body.templateId }
          : {}),
        ...(body.groupId !== undefined ? { groupId: body.groupId } : {}),
        ...(body.htmlContent !== undefined
          ? { htmlContent: body.htmlContent }
          : {}),
        ...(body.scheduledFor !== undefined
          ? {
              scheduledFor: body.scheduledFor
                ? new Date(body.scheduledFor)
                : null,
              status: body.scheduledFor
                ? EmailCampaignStatus.SCHEDULED
                : EmailCampaignStatus.DRAFT,
            }
          : {}),
      },
    });
  }

  delete(id: string) {
    return this._campaign.model.emailCampaign.delete({ where: { id } });
  }

  markSending(id: string, totalRecipients: number) {
    return this._campaign.model.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.SENDING, totalRecipients },
    });
  }

  markSent(id: string, sentCount: number, failedCount: number) {
    return this._campaign.model.emailCampaign.update({
      where: { id },
      data: {
        status: EmailCampaignStatus.SENT,
        sentAt: new Date(),
        sentCount,
        failedCount,
      },
    });
  }

  markFailed(id: string) {
    return this._campaign.model.emailCampaign.update({
      where: { id },
      data: { status: EmailCampaignStatus.FAILED },
    });
  }

  createLog(campaignId: string, email: string, userId?: string) {
    return this._log.model.emailLog.create({
      data: { campaignId, email, userId, status: EmailLogStatus.PENDING },
    });
  }

  markLogSent(id: string) {
    return this._log.model.emailLog.update({
      where: { id },
      data: { status: EmailLogStatus.SENT, sentAt: new Date() },
    });
  }

  markLogFailed(id: string, error: string) {
    return this._log.model.emailLog.update({
      where: { id },
      data: { status: EmailLogStatus.FAILED, error },
    });
  }

  listLogs(campaignId: string) {
    return this._log.model.emailLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }
}
