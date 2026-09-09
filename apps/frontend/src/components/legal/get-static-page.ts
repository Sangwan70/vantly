// Server-side data fetch for the DB-backed marketing/legal pages
// (/, /pricing, /blog, /privacy, /terms) - calls the backend's public
// (no-auth) /public/static-pages/:slug endpoint directly, same
// BACKEND_INTERNAL_URL + cache:'no-store' pattern already used by
// get-blog-posts.ts, rather than through internalFetch (which forwards
// auth cookies a logged-out visitor won't have, and this data needs
// none). Returns null on any failure or missing row so callers fall back
// to their own hardcoded default copy - see each page.tsx's own DEFAULT
// constants.
//
// Every field is applied independently by the caller (`override?.title ??
// DEFAULT_TITLE`, etc.), not all-or-nothing: an admin who has only set a
// custom hero image for the home page, say, should see that image with
// the rest of the hero (headline, subtitle, CTAs) unchanged - matching
// vantly-ugc.com's Content Management page's own per-field behavior
// ("setting a title/subtitle here replaces the animated headline with
// static text, and setting a hero image replaces the animated
// background").

export interface StaticPageContent {
  title?: string | null;
  contentHtml?: string | null;
  heroImageUrl?: string | null;
  heroVideoUrl?: string | null;
  heroOverlayOpacity?: number | null;
  ctaPrimaryText?: string | null;
  ctaSecondaryText?: string | null;
  updatedAt?: string | null;
}

export async function getStaticPageOverride(
  slug: string
): Promise<StaticPageContent | null> {
  try {
    const res = await fetch(
      `${process.env.BACKEND_INTERNAL_URL}/public/static-pages/${encodeURIComponent(slug)}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    return data as StaticPageContent;
  } catch {
    return null;
  }
}
