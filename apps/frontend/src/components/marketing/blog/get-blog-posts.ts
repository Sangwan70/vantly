// Server-side data fetch for the public blog - calls the backend's public
// (no-auth) /public/blog/* endpoints directly rather than through
// internalFetch, since internalFetch forwards auth cookies that a
// logged-out marketing-site visitor won't have and this data needs none.
// Mirrors the same BACKEND_INTERNAL_URL pattern used by
// apps/frontend/src/app/(app)/layout.tsx's resolveActiveGateway().

export const BLOG_LIST_PAGE_SIZE = 8;

export interface BlogPostPreview {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
}

export interface BlogPostFull extends BlogPostPreview {
  contentHtml: string;
  seoDescription?: string | null;
}

export interface BlogPostPage {
  posts: BlogPostPreview[];
  hasMore: boolean;
}

export async function listPublishedBlogPosts(
  offset = 0,
  limit = BLOG_LIST_PAGE_SIZE
): Promise<BlogPostPage> {
  try {
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/public/blog/posts?offset=${offset}&limit=${limit}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return { posts: [], hasMore: false };
    return (await res.json()) as BlogPostPage;
  } catch {
    return { posts: [], hasMore: false };
  }
}

export async function getPublishedBlogPost(
  slug: string
): Promise<BlogPostFull | null> {
  try {
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/public/blog/posts/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    return (await res.json()) as BlogPostFull;
  } catch {
    return null;
  }
}
