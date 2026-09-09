import { Injectable } from '@nestjs/common';
import { EmailTemplateRepository } from '@gitroom/nestjs-libraries/database/prisma/mailer/email-template.repository';
import { EmailTemplateDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-template.dto';
import { SAMPLE_TEMPLATES } from '@gitroom/nestjs-libraries/database/prisma/mailer/sample-templates';

@Injectable()
export class EmailTemplateService {
  constructor(private _emailTemplateRepository: EmailTemplateRepository) {}

  async list() {
    if ((await this._emailTemplateRepository.count()) === 0) {
      for (const template of SAMPLE_TEMPLATES) {
        await this._emailTemplateRepository.create(template, true);
      }
    }
    return this._emailTemplateRepository.list();
  }

  getById(id: string) {
    return this._emailTemplateRepository.getById(id);
  }

  create(body: EmailTemplateDto) {
    return this._emailTemplateRepository.create(body, false);
  }

  update(id: string, body: Partial<EmailTemplateDto>) {
    return this._emailTemplateRepository.update(id, body);
  }

  delete(id: string) {
    return this._emailTemplateRepository.delete(id);
  }

  // A sample is never edited in place - "editing" one in the admin UI
  // always creates a fresh, ordinary (non-sample) copy instead, so the
  // seeded starters stay available as a stable base for everyone.
  async duplicate(id: string, name?: string) {
    const source = await this._emailTemplateRepository.getById(id);
    if (!source) throw new Error('Template not found');
    return this._emailTemplateRepository.create(
      {
        name: name || `${source.name} (copy)`,
        subject: source.subject,
        htmlContent: source.htmlContent,
      },
      false
    );
  }
}
