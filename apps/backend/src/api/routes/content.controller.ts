import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetUserFromRequest } from '@gitroom/nestjs-libraries/user/user.from.request';
import { User } from '@prisma/client';
import { BlogService } from '@gitroom/nestjs-libraries/database/prisma/content/blog.service';
import { BlogPostDto } from '@gitroom/nestjs-libraries/dtos/content/blog-post.dto';
import {
  StaticPagesService,
  STATIC_PAGE_SLUGS,
  StaticPageSlug,
} from '@gitroom/nestjs-libraries/database/prisma/content/static-pages.service';
import { StaticPageDto } from '@gitroom/nestjs-libraries/dtos/content/static-page.dto';

// Admin-only content management: blog posts and the fixed set of
// admin-editable marketing pages. Public read access to the same data is
// served separately from PublicController (no auth) - see its
// /public/blog/* and /public/static-pages/:slug routes.
@ApiTags('Content')
@Controller('/admin/content')
export class ContentController {
  constructor(
    private _blogService: BlogService,
    private _staticPagesService: StaticPagesService
  ) {}

  private assertSuperAdmin(user: User) {
    if (!user?.isSuperAdmin) {
      throw new HttpException('Unauthorized', 400);
    }
  }

  @Get('/blog')
  async listBlogPosts(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    return this._blogService.listAllForAdmin();
  }

  @Get('/blog/:id')
  async getBlogPost(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    const post = await this._blogService.getById(id);
    if (!post) {
      throw new HttpException('Not found', 404);
    }
    return post;
  }

  @Post('/blog')
  async createBlogPost(
    @GetUserFromRequest() user: User,
    @Body() body: BlogPostDto
  ) {
    this.assertSuperAdmin(user);
    return this._blogService.create(body, user.id);
  }

  @Put('/blog/:id')
  async updateBlogPost(
    @GetUserFromRequest() user: User,
    @Param('id') id: string,
    @Body() body: Partial<BlogPostDto>
  ) {
    this.assertSuperAdmin(user);
    return this._blogService.update(id, body);
  }

  @Delete('/blog/:id')
  async deleteBlogPost(
    @GetUserFromRequest() user: User,
    @Param('id') id: string
  ) {
    this.assertSuperAdmin(user);
    await this._blogService.delete(id);
    return { deleted: true };
  }

  @Get('/static-pages')
  async listStaticPages(@GetUserFromRequest() user: User) {
    this.assertSuperAdmin(user);
    const rows = await this._staticPagesService.listAll();
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    // Always return every fixed slug, even ones with no row yet, so the
    // admin UI can render a full, stable list of editable pages.
    // `customized` reflects whether an ADMIN has actually saved something
    // for this slug - NOT just whether a row exists. privacy/terms get a
    // real row auto-seeded on first read (see ensureDefaultSeeded) so their
    // editors show real starting copy instead of a blank form; that seed
    // row is tagged `updatedBy: 'system:default-seed'` specifically so it
    // can be told apart here from a genuine admin save (which always
    // carries the admin's user id). Without this check, privacy/terms
    // would permanently show as "Customized" even when nobody has ever
    // touched them.
    return STATIC_PAGE_SLUGS.map((slug) => {
      const row = bySlug.get(slug);
      const customized = !!row && row.updatedBy !== 'system:default-seed';
      return row ? { ...row, customized } : { slug, customized: false };
    });
  }

  @Put('/static-pages/:slug')
  async updateStaticPage(
    @GetUserFromRequest() user: User,
    @Param('slug') slug: string,
    @Body() body: StaticPageDto
  ) {
    this.assertSuperAdmin(user);
    if (!STATIC_PAGE_SLUGS.includes(slug as StaticPageSlug)) {
      throw new HttpException('Unknown page slug', 400);
    }
    return this._staticPagesService.upsert(
      slug as StaticPageSlug,
      body,
      user.id
    );
  }

  // "Revert to default" - deletes the saved override so the page falls
  // back to its own hardcoded default copy on the very next request.
  @Delete('/static-pages/:slug')
  async revertStaticPage(
    @GetUserFromRequest() user: User,
    @Param('slug') slug: string
  ) {
    this.assertSuperAdmin(user);
    if (!STATIC_PAGE_SLUGS.includes(slug as StaticPageSlug)) {
      throw new HttpException('Unknown page slug', 400);
    }
    await this._staticPagesService.revertToDefault(slug as StaticPageSlug);
    return { reverted: true };
  }
}
