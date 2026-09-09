import { LegalPageLayout } from '@gitroom/frontend/components/legal/legal-page-layout.component';
import { getStaticPageOverride } from '@gitroom/frontend/components/legal/get-static-page';

// Reads the admin-editable override from StaticPagesService (slug
// "contact") at request time and falls back to the hardcoded copy below
// only if no row exists yet or its contentHtml is empty - mirrors
// privacy/page.tsx and terms/page.tsx exactly, see get-static-page.ts and
// static-pages.service.ts's own DEFAULT_STATIC_PAGE_CONTENT doc comment.
export const dynamic = 'force-dynamic';

const FALLBACK_LAST_UPDATED = 'September 3, 2026';

const FALLBACK_CONTENT = (
  <>
    <p>
      We&rsquo;d love to hear from you. Whether you have a question about
      features, pricing, your account, or anything else, our team is ready
      to help.
    </p>

    <h2>Email</h2>
    <p>
      The fastest way to reach us is by email at{' '}
      <a href="mailto:we@vantly.social">we@vantly.social</a>. We aim to
      respond to all inquiries within one business day.
    </p>

    <h2>Support</h2>
    <p>
      Existing customers with account or billing questions can also reach
      out from within the app, or reply directly to any of our email
      notifications.
    </p>

    <h2>Sales &amp; Partnerships</h2>
    <p>
      Interested in a custom plan, an integration, or a partnership? Email
      us at <a href="mailto:we@vantly.social">we@vantly.social</a> and let
      us know a bit about what you&rsquo;re looking for.
    </p>
  </>
);

export default async function ContactPage() {
  const override = await getStaticPageOverride('contact');

  if (override?.contentHtml) {
    const lastUpdated = override.updatedAt
      ? new Date(override.updatedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : FALLBACK_LAST_UPDATED;
    return (
      <LegalPageLayout title={override.title || 'Contact Us'} lastUpdated={lastUpdated}>
        <div dangerouslySetInnerHTML={{ __html: override.contentHtml }} />
      </LegalPageLayout>
    );
  }

  return (
    <LegalPageLayout title="Contact Us" lastUpdated={FALLBACK_LAST_UPDATED}>
      {FALLBACK_CONTENT}
    </LegalPageLayout>
  );
}
