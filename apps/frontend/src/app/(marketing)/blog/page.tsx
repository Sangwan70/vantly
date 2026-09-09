import { Metadata } from 'next';
import { MarketingHeader } from '@gitroom/frontend/components/marketing/marketing-header.component';
import { MarketingFooter } from '@gitroom/frontend/components/marketing/marketing-footer.component';
import { BlogGrid } from '@gitroom/frontend/components/marketing/blog/blog-grid';
import {
  BLOG_LIST_PAGE_SIZE,
  listPublishedBlogPosts,
} from '@gitroom/frontend/components/marketing/blog/get-blog-posts';
import { getStaticPageOverride } from '@gitroom/frontend/components/legal/get-static-page';
import Image from 'next/image';

// Content changes over time and is paginated - unlike the rest of the
// marketing site (force-static), this listing is rendered per request.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog - Vantly',
  description:
    'Product updates, guides, and ideas for scheduling and growing every social channel with Vantly.',
};

export default async function BlogIndexPage() {
  const [firstPage, override] = await Promise.all([
    listPublishedBlogPosts(0, BLOG_LIST_PAGE_SIZE),
    getStaticPageOverride('blog'),
  ]);

  return (
    <div className="min-h-screen w-full flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        {/* Hero - overridable from Admin Panel -> Content -> Blog. */}
        <section className="relative max-w-[1200px] mx-auto px-[20px] pt-[72px] pb-[24px] text-center overflow-hidden rounded-[24px]">
          {(override?.heroImageUrl || override?.heroVideoUrl) && (
            <div className="absolute inset-0 -z-10">
              {override.heroVideoUrl ? (
                <video
                  src={override.heroVideoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <Image
                  src={override.heroImageUrl!}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                />
              )}
              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: (override.heroOverlayOpacity ?? 45) / 100 }}
              />
            </div>
          )}
          <h1 className="text-[34px] md:text-[48px] font-[700] -tracking-[0.8px] text-textColor">
            {override?.title || 'Blog'}
          </h1>
          <p className="mt-[16px] text-[16px] leading-[1.6] text-textColor/65 max-w-[560px] mx-auto">
            {override?.contentHtml ||
              'Product updates, guides, and ideas for growing every social channel.'}
          </p>
        </section>
        <section className="max-w-[1200px] mx-auto px-[20px] pb-[80px]">
          <BlogGrid
            initialPosts={firstPage.posts}
            initialHasMore={firstPage.hasMore}
          />
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
