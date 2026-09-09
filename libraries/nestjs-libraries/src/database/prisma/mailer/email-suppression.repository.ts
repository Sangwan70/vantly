import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailSuppressionRepository {
  constructor(private _suppression: PrismaRepository<'emailSuppression'>) {}

  list() {
    return this._suppression.model.emailSuppression.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  add(email: string, reason: string) {
    return this._suppression.model.emailSuppression.upsert({
      where: { email: email.toLowerCase() },
      create: { email: email.toLowerCase(), reason },
      update: {},
    });
  }

  remove(email: string) {
    return this._suppression.model.emailSuppression.delete({
      where: { email: email.toLowerCase() },
    });
  }
}
