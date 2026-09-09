import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { BlogPostDto } from '@gitroom/nestjs-libraries/dtos/content/blog-post.dto';
import { BlogPostStatus } from '@prisma/client';

@Injectable()
export class BlogRepository {
  constructor(private _blogPost: PrismaRepository<'blogPost'>) {}

  listAllForAdmin() {
    return this._blogPost.model.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPublished(offset: number, limit: number) {
    const [posts, total] = await Promise.all([
      this._blogPost.model.blogPost.findMany({
        where: { status: BlogPostStatus.PUBLISHED },
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this._blogPost.model.blogPost.count({
        where: { status: BlogPostStatus.PUBLISHED },
      }),
    ]);
    return { posts, hasMore: offset + posts.length < total };
  }

  getPublishedBySlug(slug: string) {
    return this._blogPost.model.blogPost.findFirst({
      where: { slug, status: BlogPostStatus.PUBLISHED },
    });
  }

  getById(id: string) {
    return this._blogPost.model.blogPost.findUnique({ where: { id } });
  }

  create(body: BlogPostDto, createdBy: string) {
    return this._blogPost.model.blogPost.create({
      data: {
        title: body.title,
        slug: body.slug,
        excerpt: body.excerpt,
        coverImageUrl: body.coverImageUrl,
        contentHtml: body.contentHtml,
        status: (body.status as BlogPostStatus) || BlogPostStatus.DRAFT,
        seoDescription: body.seoDescription,
        createdBy,
        publishedAt: body.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }

  async update(id: string, body: Partial<BlogPostDto>) {
    const existing = await this.getById(id);
    const willPublishNow =
      body.status === 'PUBLISHED' && existing?.status !== 'PUBLISHED';

    return this._blogPost.model.blogPost.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.slug !== undefined ? { slug: body.slug } : {}),
        ...(body.excerpt !== undefined ? { excerpt: body.excerpt } : {}),
        ...(body.coverImageUrl !== undefined
          ? { coverImageUrl: body.coverImageUrl }
          : {}),
        ...(body.contentHtml !== undefined
          ? { contentHtml: body.contentHtml }
          : {}),
        ...(body.status !== undefined
          ? { status: body.status as BlogPostStatus }
          : {}),
        ...(body.seoDescription !== undefined
          ? { seoDescription: body.seoDescription }
          : {}),
        ...(willPublishNow ? { publishedAt: new Date() } : {}),
      },
    });
  }

  delete(id: string) {
    return this._blogPost.model.blogPost.delete({ where: { id } });
  }
}
