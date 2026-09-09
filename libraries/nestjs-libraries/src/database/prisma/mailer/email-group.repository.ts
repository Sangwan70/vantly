import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { EmailGroupDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-group.dto';
import { EmailGroupType, Prisma } from '@prisma/client';

@Injectable()
export class EmailGroupRepository {
  constructor(private _group: PrismaRepository<'emailGroup'>) {}

  list() {
    return this._group.model.emailGroup.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  count() {
    return this._group.model.emailGroup.count();
  }

  getById(id: string) {
    return this._group.model.emailGroup.findUnique({ where: { id } });
  }

  create(body: Pick<EmailGroupDto, 'name' | 'description' | 'type' | 'memberEmails' | 'smartRules'>) {
    return this._group.model.emailGroup.create({
      data: {
        name: body.name,
        description: body.description,
        type: body.type as EmailGroupType,
        memberEmails: body.memberEmails || [],
        smartRules: (body.smartRules ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  update(id: string, body: Partial<EmailGroupDto>) {
    return this._group.model.emailGroup.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.description !== undefined
          ? { description: body.description }
          : {}),
        ...(body.type !== undefined
          ? { type: body.type as EmailGroupType }
          : {}),
        ...(body.memberEmails !== undefined
          ? { memberEmails: body.memberEmails }
          : {}),
        ...(body.smartRules !== undefined
          ? { smartRules: body.smartRules as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  delete(id: string) {
    return this._group.model.emailGroup.delete({ where: { id } });
  }
}
