import { Injectable } from '@nestjs/common';
import { BlogRepository } from '@gitroom/nestjs-libraries/database/prisma/content/blog.repository';
import { BlogPostDto } from '@gitroom/nestjs-libraries/dtos/content/blog-post.dto';

// Shared between the server-rendered first page (apps/frontend blog listing)
// and the public /api/blog/posts pagination endpoint's default limit -
// keep both in sync by importing this rather than hardcoding 8 twice.
export const BLOG_LIST_PAGE_SIZE = 8;

@Injectable()
export class BlogService {
  constructor(private _blogRepository: BlogRepository) {}

  listAllForAdmin() {
    return this._blogRepository.listAllForAdmin();
  }

  listPublished(offset = 0, limit = BLOG_LIST_PAGE_SIZE) {
    return this._blogRepository.listPublished(offset, limit);
  }

  getPublishedBySlug(slug: string) {
    return this._blogRepository.getPublishedBySlug(slug);
  }

  getById(id: string) {
    return this._blogRepository.getById(id);
  }

  create(body: BlogPostDto, createdBy: string) {
    return this._blogRepository.create(body, createdBy);
  }

  update(id: string, body: Partial<BlogPostDto>) {
    return this._blogRepository.update(id, body);
  }

  delete(id: string) {
    return this._blogRepository.delete(id);
  }
}
