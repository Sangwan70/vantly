import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EmailCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsOptional()
  @IsString()
  templateId?: string;

  @IsString()
  @IsNotEmpty()
  groupId: string;

  @IsString()
  htmlContent: string;

  // Accepted and stored (moves the campaign to SCHEDULED - see
  // email-campaign.repository.ts's create()/update()), but nothing yet
  // polls for due campaigns and calls sendNow() on them: there is no
  // cron/queue wired up for this. The admin UI (mailer-admin.component.tsx)
  // deliberately never sets this field for that reason - only "Send now"
  // is exposed today. Wire up a scheduler (or drop this field) before
  // relying on it via direct API use.
  @IsOptional()
  @IsDateString()
  scheduledFor?: string;
}
