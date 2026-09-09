import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StaticPageDto } from '@gitroom/nestjs-libraries/dtos/content/static-page.dto';

@Injectable()
export class StaticPagesRepository {
  constructor(private _staticPage: PrismaRepository<'staticPage'>) {}

  getBySlug(slug: string) {
    return this._staticPage.model.staticPage.findUnique({ where: { slug } });
  }

  listAll() {
    return this._staticPage.model.staticPage.findMany();
  }

  upsert(slug: string, body: StaticPageDto, updatedBy: string) {
    return this._staticPage.model.staticPage.upsert({
      where: { slug },
      create: { slug, ...body, updatedBy },
      update: { ...body, updatedBy },
    });
  }

  // "Revert to default" in the admin UI - deletes the override row
  // entirely so the page falls back to its own hardcoded default copy,
  // rather than upserting empty strings over every field (which would
  // leave a "customized" row with no content instead of no row at all).
  async delete(slug: string) {
    try {
      await this._staticPage.model.staticPage.delete({ where: { slug } });
    } catch (error) {
      // Only swallow Prisma's "record not found" (P2025) - that means
      // there was already nothing to revert, which is the same successful
      // end state as deleting it. Any other error (DB connection failure,
      // constraint violation, etc.) is a real failure and must not be
      // reported to the admin UI as a successful revert.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return;
      }
      throw error;
    }
  }
}
