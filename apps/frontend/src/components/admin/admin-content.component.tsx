'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { BlogBodyEditor } from '@gitroom/frontend/components/admin/blog-body-editor.component';

interface BlogPostRow {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  contentHtml: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  seoDescription?: string | null;
}

interface StaticPageRow {
  slug: string;
  title?: string | null;
  contentHtml?: string | null;
  heroImageUrl?: string | null;
  heroVideoUrl?: string | null;
  heroOverlayOpacity?: number | null;
  ctaPrimaryText?: string | null;
  ctaSecondaryText?: string | null;
  // Whether an override row actually exists for this slug (vs. the fixed
  // slug-only placeholder the admin API always returns) - drives the
  // Customized/Default badge and whether "Revert to default" shows.
  customized?: boolean;
}

const BLOG_KEY = '/admin/content/blog';
const PAGES_KEY = '/admin/content/static-pages';

// Each SWR call in its own hook per CLAUDE.md's rule.
const useBlogPosts = () => {
  const fetch = useFetch();
  return useSWR<BlogPostRow[]>(BLOG_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load blog posts');
    return res.json();
  });
};

const useStaticPages = () => {
  const fetch = useFetch();
  return useSWR<StaticPageRow[]>(PAGES_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load pages');
    return res.json();
  });
};

const emptyPost = (): Partial<BlogPostRow> => ({
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  contentHtml: '<p></p>',
  status: 'DRAFT',
  seoDescription: '',
});

const BlogEditor: FC<{
  post: Partial<BlogPostRow>;
  onClose: () => void;
}> = ({ post, onClose }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [form, setForm] = useState<Partial<BlogPostRow>>(post);
  const [saving, setSaving] = useState(false);

  const set = useCallback(
    <K extends keyof BlogPostRow>(key: K, value: BlogPostRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const handleSave = useCallback(async () => {
    if (!form.title?.trim() || !form.slug?.trim()) {
      toast.show('Title and slug are required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const isNew = !form.id;
      await fetch(isNew ? BLOG_KEY : `${BLOG_KEY}/${form.id}`, {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(form),
      });
      await mutate(BLOG_KEY);
      toast.show('Post saved', 'success');
      onClose();
    } catch {
      toast.show('Failed to save post', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleDelete = useCallback(async () => {
    if (!form.id) return;
    if (!window.confirm('Delete this post?')) return;
    await fetch(`${BLOG_KEY}/${form.id}`, { method: 'DELETE' });
    await mutate(BLOG_KEY);
    onClose();
  }, [form.id]);

  return (
    <div className="flex flex-col gap-[12px] border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner">
      <div className="grid grid-cols-2 gap-[12px]">
        <Input
          label="Title"
          name="title"
          disableForm={true}
          value={form.title || ''}
          onChange={(e) => set('title', e.target.value)}
        />
        <Input
          label="Slug"
          name="slug"
          disableForm={true}
          value={form.slug || ''}
          onChange={(e) => set('slug', e.target.value)}
        />
      </div>
      <Input
        label="Excerpt"
        name="excerpt"
        disableForm={true}
        value={form.excerpt || ''}
        onChange={(e) => set('excerpt', e.target.value)}
      />
      <Input
        label="Cover image URL"
        name="coverImageUrl"
        disableForm={true}
        value={form.coverImageUrl || ''}
        onChange={(e) => set('coverImageUrl', e.target.value)}
      />
      <div className="grid grid-cols-2 gap-[12px] items-end">
        <Select
          label="Status"
          name="status"
          disableForm={true}
          value={form.status || 'DRAFT'}
          onChange={(e) => set('status', e.target.value as BlogPostRow['status'])}
        >
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Select>
        <Input
          label="SEO description"
          name="seoDescription"
          disableForm={true}
          value={form.seoDescription || ''}
          onChange={(e) => set('seoDescription', e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">Body</label>
        <BlogBodyEditor
          value={form.contentHtml || '<p></p>'}
          onChange={(html) => set('contentHtml', html)}
        />
      </div>
      <div className="flex items-center gap-[8px]">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button onClick={onClose} secondary={true}>
          Cancel
        </Button>
        {form.id && (
          <Button onClick={handleDelete} secondary={true}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

const BlogTab: FC = () => {
  const { data, isLoading } = useBlogPosts();
  const [editing, setEditing] = useState<Partial<BlogPostRow> | null>(null);

  if (isLoading || !data) return <LoadingComponent />;

  if (editing) {
    return <BlogEditor post={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <Button onClick={() => setEditing(emptyPost())}>New Post</Button>
      </div>
      <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_120px] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder">
          <div>Title</div>
          <div>Status</div>
          <div />
        </div>
        {data.length === 0 ? (
          <div className="px-[12px] py-[10px] text-[13px] opacity-70">
            No posts yet.
          </div>
        ) : (
          data.map((post) => (
            <div
              key={post.id}
              className="grid grid-cols-[1fr_120px_120px] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center"
            >
              <div>{post.title}</div>
              <div className="capitalize">{post.status.toLowerCase()}</div>
              <div>
                <button
                  type="button"
                  className="text-forth cursor-pointer"
                  onClick={() => setEditing(post)}
                >
                  Edit
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Per-slug shape of the Content Management editor, mirroring
// vantly-ugc.com's Content page: hero-type pages (home/pricing/blog) get a
// plain-text subtitle + optional hero background image/video/overlay;
// body-type pages (privacy/terms/contact) get a single rich-text body instead, no
// hero fields at all. showCta is further narrowed to just the pages whose
// live hero actually renders CTA buttons today (only the home page) -
// showing CTA text fields that nothing on the page reads would be a dead
// control, not a real setting.
const PAGE_META: Record<
  string,
  { label: string; type: 'hero' | 'body'; showCta: boolean }
> = {
  home: { label: 'Home', type: 'hero', showCta: true },
  pricing: { label: 'Pricing', type: 'hero', showCta: false },
  blog: { label: 'Blog', type: 'hero', showCta: false },
  privacy: { label: 'Privacy Policy', type: 'body', showCta: false },
  terms: { label: 'Terms of Service', type: 'body', showCta: false },
  contact: { label: 'Contact Us', type: 'body', showCta: false },
};
const PAGE_ORDER = [
  'home',
  'pricing',
  'blog',
  'privacy',
  'terms',
  'contact',
];

const blankPageForm = (slug: string): StaticPageRow => ({
  slug,
  title: '',
  contentHtml: '',
  heroImageUrl: '',
  heroVideoUrl: '',
  heroOverlayOpacity: 45,
  ctaPrimaryText: '',
  ctaSecondaryText: '',
  customized: false,
});

const PageEditor: FC<{ page: StaticPageRow; onReverted: () => void }> = ({
  page,
  onReverted,
}) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [form, setForm] = useState<StaticPageRow>(page);
  const [saving, setSaving] = useState(false);
  const [reverting, setReverting] = useState(false);

  const meta = PAGE_META[form.slug] || {
    label: form.slug,
    type: 'body' as const,
    showCta: false,
  };

  const set = useCallback(
    <K extends keyof StaticPageRow>(key: K, value: StaticPageRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`${PAGES_KEY}/${form.slug}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      await mutate(PAGES_KEY);
      // Reflect the save locally right away - `page` (and the tab-bar dot
      // fed by the /static-pages list) won't refresh until the mutate()
      // above resolves and this component happens to remount, which
      // otherwise leaves a freshly-customized page still showing the
      // "Default" badge and a hidden Revert button until the admin
      // switches tabs away and back.
      setForm((prev) => ({ ...prev, customized: true }));
      toast.show('Page saved', 'success');
    } catch {
      toast.show('Failed to save page', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleRevert = useCallback(async () => {
    if (
      !window.confirm(
        'Revert this page back to its hardcoded default? This deletes the saved override.'
      )
    ) {
      return;
    }
    setReverting(true);
    try {
      await fetch(`${PAGES_KEY}/${form.slug}`, { method: 'DELETE' });
      await mutate(PAGES_KEY);
      setForm(blankPageForm(form.slug));
      toast.show('Page reverted to default', 'success');
      onReverted();
    } catch {
      toast.show('Failed to revert page', 'warning');
    } finally {
      setReverting(false);
    }
  }, [form.slug]);

  return (
    <div className="flex flex-col gap-[12px] border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner">
      <div className="flex items-center justify-between">
        <div className="text-[15px] font-[600]">{meta.label}</div>
        <div
          className={`text-[11px] uppercase tracking-[0.05em] font-[600] rounded-full px-[8px] py-[2px] ${
            form.customized
              ? 'text-forth bg-forth/10'
              : 'opacity-60 bg-tableBorder/40'
          }`}
        >
          {form.customized ? 'Customized' : 'Default'}
        </div>
      </div>

      <Input
        label={meta.type === 'body' ? 'Title' : 'Title (hero headline)'}
        name={`title-${form.slug}`}
        disableForm={true}
        value={form.title || ''}
        onChange={(e) => set('title', e.target.value)}
      />

      {meta.type === 'body' ? (
        <div className="flex flex-col gap-[6px]">
          <label className="text-[14px]">Body content</label>
          <BlogBodyEditor
            value={form.contentHtml || '<p></p>'}
            onChange={(html) => set('contentHtml', html)}
          />
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-[6px] text-[14px]">
            Subtitle (plain text, shown under the hero title)
            <textarea
              value={form.contentHtml || ''}
              onChange={(e) => set('contentHtml', e.target.value)}
              rows={2}
              className="bg-newBgColorInner border border-newTableBorder rounded-[8px] px-[16px] py-[10px] text-[14px] text-textColor"
            />
          </label>

          {meta.showCta && (
            <div className="grid grid-cols-2 gap-[12px]">
              <Input
                label="Primary CTA text"
                name={`cta1-${form.slug}`}
                disableForm={true}
                value={form.ctaPrimaryText || ''}
                onChange={(e) => set('ctaPrimaryText', e.target.value)}
              />
              <Input
                label="Secondary CTA text"
                name={`cta2-${form.slug}`}
                disableForm={true}
                value={form.ctaSecondaryText || ''}
                onChange={(e) => set('ctaSecondaryText', e.target.value)}
              />
            </div>
          )}

          <div className="text-[14px] mt-[4px]">Hero background (optional)</div>
          <div className="grid grid-cols-2 gap-[12px]">
            <Input
              label="Hero image URL"
              name={`hero-image-${form.slug}`}
              disableForm={true}
              value={form.heroImageUrl || ''}
              onChange={(e) => set('heroImageUrl', e.target.value)}
            />
            <Input
              label="Hero video URL (takes priority over image)"
              name={`hero-video-${form.slug}`}
              disableForm={true}
              value={form.heroVideoUrl || ''}
              onChange={(e) => set('heroVideoUrl', e.target.value)}
            />
          </div>
          <Input
            label="Overlay darkness (0-100, only applies when an image/video is set)"
            name={`hero-overlay-${form.slug}`}
            disableForm={true}
            type="number"
            value={String(form.heroOverlayOpacity ?? 45)}
            onChange={(e) => set('heroOverlayOpacity', Number(e.target.value))}
          />
        </>
      )}

      <div className="flex items-center gap-[8px] mt-[4px]">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        {form.customized && (
          <Button onClick={handleRevert} loading={reverting} secondary={true}>
            Revert to default
          </Button>
        )}
      </div>
    </div>
  );
};

const PagesTab: FC = () => {
  const { data, isLoading, mutate } = useStaticPages();
  const [activeSlug, setActiveSlug] = useState<string>(PAGE_ORDER[0]);

  if (isLoading || !data) return <LoadingComponent />;

  const activePage =
    data.find((p) => p.slug === activeSlug) || blankPageForm(activeSlug);

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[13px] opacity-70 max-w-[640px]">
        A fixed set of pages - no row means the page still uses its
        hardcoded default copy. Every page below is read live on each
        request, so a save here shows up on the real site immediately.
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-newTableBorder">
        {PAGE_ORDER.map((slug) => {
          const item = data.find((p) => p.slug === slug);
          const active = slug === activeSlug;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setActiveSlug(slug)}
              className={`flex shrink-0 items-center gap-[6px] whitespace-nowrap px-[16px] py-[10px] text-[13px] border-b-2 cursor-pointer ${
                active
                  ? 'border-forth text-textColor font-[600]'
                  : 'border-transparent text-textColor/60'
              }`}
            >
              {PAGE_META[slug]?.label || slug}
              {item?.customized && (
                <span className="h-[6px] w-[6px] rounded-full bg-forth" />
              )}
            </button>
          );
        })}
      </div>

      <PageEditor
        key={activeSlug}
        page={activePage}
        onReverted={() => void mutate()}
      />
    </div>
  );
};

export const AdminContentComponent: FC = () => {
  const user = useUser();
  const [tab, setTab] = useState<'blog' | 'pages'>('blog');

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] text-textColor p-[20px]">
      <div className="text-[20px] font-[600]">Content Management</div>
      <div className="flex gap-[8px]">
        {(['blog', 'pages'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-[32px] px-[12px] rounded-[8px] text-[13px] border cursor-pointer whitespace-nowrap ${
              tab === key
                ? 'bg-forth text-white border-forth'
                : 'bg-newBgColorInner text-textColor border-newTableBorder hover:bg-tableBorder'
            }`}
          >
            {key === 'blog' ? 'Blog' : 'Marketing Pages'}
          </button>
        ))}
      </div>
      {tab === 'blog' ? <BlogTab /> : <PagesTab />}
    </div>
  );
};
