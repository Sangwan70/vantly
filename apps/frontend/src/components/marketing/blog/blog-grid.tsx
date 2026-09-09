'use client';

import React, { FC, useCallback, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BLOG_LIST_PAGE_SIZE,
  BlogPostPreview,
} from '@gitroom/frontend/components/marketing/blog/get-blog-posts';

const formatDate = (value?: string | null) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const BlogPostCard: FC<{ post: BlogPostPreview }> = ({ post }) => (
  <Link
    href={`/blog/${post.slug}`}
    className="flex flex-col gap-[10px] group"
  >
    <div className="relative w-full aspect-[16/10] rounded-[12px] overflow-hidden bg-newBgColorInner border border-newTableBorder">
      {post.coverImageUrl && (
        <Image
          src={post.coverImageUrl}
          alt={post.title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      )}
    </div>
    <div className="text-[12px] opacity-60">{formatDate(post.publishedAt)}</div>
    <div className="text-[16px] font-[600] text-textColor leading-[1.3]">
      {post.title}
    </div>
    {post.excerpt && (
      <div className="text-[13px] opacity-70 leading-[1.5] line-clamp-2">
        {post.excerpt}
      </div>
    )}
  </Link>
);

export const BlogGrid: FC<{
  initialPosts: BlogPostPreview[];
  initialHasMore: boolean;
}> = ({ initialPosts, initialHasMore }) => {
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // (marketing) is a deliberately provider-free root layout (see its
      // own doc comment) - no VariableContext/useFetch here, so this calls
      // the backend's public endpoint directly with the same
      // NEXT_PUBLIC_BACKEND_URL every other client component resolves
      // through useVariables().backendUrl.
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/public/blog/posts?offset=${posts.length}&limit=${BLOG_LIST_PAGE_SIZE}`
      );
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const page = (await res.json()) as {
        posts: BlogPostPreview[];
        hasMore: boolean;
      };
      setPosts((prev) => [...prev, ...page.posts]);
      setHasMore(page.hasMore);
    } catch {
      setError('Could not load more posts - please try again.');
    } finally {
      setLoading(false);
    }
  }, [posts.length]);

  if (posts.length === 0) {
    return (
      <div className="text-center text-[14px] opacity-60 py-[40px]">
        No posts published yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[32px]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[28px]">
        {posts.map((post) => (
          <BlogPostCard key={post.id} post={post} />
        ))}
      </div>
      {error && (
        <div className="text-center text-[13px] text-red-400">{error}</div>
      )}
      {hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="h-[40px] px-[24px] rounded-[8px] text-[14px] border border-newTableBorder bg-newBgColorInner text-textColor hover:bg-tableBorder disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
};
