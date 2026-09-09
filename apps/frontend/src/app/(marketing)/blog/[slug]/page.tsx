import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { MarketingHeader } from '@gitroom/frontend/components/marketing/marketing-header.component';
import { MarketingFooter } from '@gitroom/frontend/components/marketing/marketing-footer.component';
import { getPublishedBlogPost } from '@gitroom/frontend/components/marketing/blog/get-blog-posts';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) return { title: 'Blog - Vantly' };
  return {
    title: `${post.title} - Vantly Blog`,
    description: post.seoDescription || post.excerpt || undefined,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedBlogPost(slug);
  if (!post) notFound();

  return (
    <div className="min-h-screen w-full flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <article className="max-w-[760px] mx-auto px-[20px] pt-[72px] pb-[80px]">
          <h1 className="text-[28px] md:text-[38px] font-[700] -tracking-[0.6px] text-textColor leading-[1.2]">
            {post.title}
          </h1>
          {post.publishedAt && (
            <div className="mt-[12px] text-[13px] opacity-60">
              {new Date(post.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </div>
          )}
          {post.coverImageUrl && (
            <div className="relative w-full aspect-[16/9] rounded-[12px] overflow-hidden mt-[24px]">
              <Image
                src={post.coverImageUrl}
                alt={post.title}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div
            className="mt-[32px] text-[16px] leading-[1.7] text-textColor/90 [&_h2]:text-[24px] [&_h2]:font-[600] [&_h2]:mt-[28px] [&_h2]:mb-[8px] [&_h3]:text-[19px] [&_h3]:font-[600] [&_h3]:mt-[22px] [&_h3]:mb-[6px] [&_p]:mb-[14px] [&_ul]:list-disc [&_ul]:pl-[22px] [&_ul]:mb-[14px] [&_a]:underline [&_a]:text-forth"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
