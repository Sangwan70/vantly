import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { EmailGroupService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-group.service';
import { EmailGroupDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-group.dto';
import { EmailTemplateService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-template.service';
import { EmailTemplateDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-template.dto';
import { EmailCampaignService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-campaign.service';
import { EmailCampaignDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-campaign.dto';
import { EmailSuppressionService } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-suppression.service';

@ApiTags('Mailer')
@Controller('/admin/mailer')
export class MailerController {
  constructor(
    private _emailGroupService: EmailGroupService,
    private _emailTemplateService: EmailTemplateService,
    private _emailCampaignService: EmailCampaignService,
    private _emailSuppressionService: EmailSuppressionService
  ) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  // ── Groups ────────────────────────────────────────────────────────────

  @Get('/groups')
  async listGroups(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    const groups = await this._emailGroupService.list();
    const withCounts = await Promise.all(
      groups.map(async (group) => ({
        ...group,
        memberCount: (await this._emailGroupService.resolveMembers(group.id))
          .length,
      }))
    );
    return withCounts;
  }

  @Post('/groups')
  async createGroup(
    @GetUserFromRequest() user: User,
    @Body() body: EmailGroupDto
  ) {
    this.assertSuperAdmin(user);
    return this._emailGroupService.create(body);
  }

  @Put('/groups/:id')
  async updateGroup(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: Partial<EmailGroupDto>
  ) {
    this.assertSuperAdmin(user);
    return this._emailGroupService.update(id, body);
  }

  @Delete('/groups/:id')
  async deleteGroup(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    await this._emailGroupService.delete(id);
    return { deleted: true };
  }

  // File-upload (or pasted-text) import - body.text is the raw file
  // contents / pasted list, one address per line or comma-separated.
  @Post('/groups/:id/import')
  async importGroupMembers(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: { text: string }
  ) {
    this.assertSuperAdmin(user);
    return this._emailGroupService.importMembers(id, body.text || '');
  }

  @Get('/groups/:id/export')
  @Header('Content-Type', 'text/csv')
  async exportGroupMembers(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    return this._emailGroupService.exportMembersCsv(id);
  }

  // ── Templates ─────────────────────────────────────────────────────────

  @Get('/templates')
  async listTemplates(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._emailTemplateService.list();
  }

  @Post('/templates')
  async createTemplate(
    @GetUserFromRequest() user: User,
    @Body() body: EmailTemplateDto
  ) {
    this.assertSuperAdmin(user);
    return this._emailTemplateService.create(body);
  }

  @Put('/templates/:id')
  async updateTemplate(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: Partial<EmailTemplateDto>
  ) {
    this.assertSuperAdmin(user);
    return this._emailTemplateService.update(id, body);
  }

  @Post('/templates/:id/duplicate')
  async duplicateTemplate(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: { name?: string }
  ) {
    this.assertSuperAdmin(user);
    return this._emailTemplateService.duplicate(id, body?.name);
  }

  @Delete('/templates/:id')
  async deleteTemplate(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    await this._emailTemplateService.delete(id);
    return { deleted: true };
  }

  // ── Campaigns ─────────────────────────────────────────────────────────

  @Get('/campaigns')
  async listCampaigns(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._emailCampaignService.list();
  }

  @Get('/campaigns/:id')
  async getCampaign(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    const campaign = await this._emailCampaignService.getById(id);
    if (!campaign) throw new HttpException('Not found', 404);
    return campaign;
  }

  @Post('/campaigns')
  async createCampaign(
    @GetUserFromRequest() user: User,
    @Body() body: EmailCampaignDto
  ) {
    this.assertSuperAdmin(user);
    return this._emailCampaignService.create(body);
  }

  @Put('/campaigns/:id')
  async updateCampaign(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: Partial<EmailCampaignDto>
  ) {
    this.assertSuperAdmin(user);
    return this._emailCampaignService.update(id, body);
  }

  @Delete('/campaigns/:id')
  async deleteCampaign(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    await this._emailCampaignService.delete(id);
    return { deleted: true };
  }

  @Post('/campaigns/:id/send')
  async sendCampaign(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    return this._emailCampaignService.sendNow(id);
  }

  @Get('/campaigns/:id/logs')
  async campaignLogs(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    return this._emailCampaignService.listLogs(id);
  }

  // ── Suppression list ─────────────────────────────────────────────────

  @Get('/suppressions')
  async listSuppressions(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._emailSuppressionService.list();
  }

  @Delete('/suppressions/:email')
  async removeSuppression(
    @GetUserFromRequest() user: User,
    @Param('email') email: string
  ) {
    this.assertSuperAdmin(user);
    await this._emailSuppressionService.unsuppress(email);
    return { removed: true };
  }
}
