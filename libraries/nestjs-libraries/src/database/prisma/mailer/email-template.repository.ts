import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { EmailTemplateDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-template.dto';

@Injectable()
export class EmailTemplateRepository {
  constructor(private _template: PrismaRepository<'emailTemplate'>) {}

  list() {
    return this._template.model.emailTemplate.findMany({
      orderBy: [{ isSample: 'asc' }, { createdAt: 'desc' }],
    });
  }

  count() {
    return this._template.model.emailTemplate.count();
  }

  getById(id: string) {
    return this._template.model.emailTemplate.findUnique({ where: { id } });
  }

  create(body: EmailTemplateDto, isSample = false) {
    return this._template.model.emailTemplate.create({
      data: {
        name: body.name,
        subject: body.subject,
        htmlContent: body.htmlContent,
        isSample,
      },
    });
  }

  update(id: string, body: Partial<EmailTemplateDto>) {
    return this._template.model.emailTemplate.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.subject !== undefined ? { subject: body.subject } : {}),
        ...(body.htmlContent !== undefined
          ? { htmlContent: body.htmlContent }
          : {}),
      },
    });
  }

  delete(id: string) {
    return this._template.model.emailTemplate.delete({ where: { id } });
  }
}
