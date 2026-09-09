import { Injectable } from '@nestjs/common';
import { StaticPagesRepository } from '@gitroom/nestjs-libraries/database/prisma/content/static-pages.repository';
import { StaticPageDto } from '@gitroom/nestjs-libraries/dtos/content/static-page.dto';

// Fixed set of admin-editable marketing pages - matches the real pages
// that exist under apps/frontend/src/app/(marketing) and the legal pages
// under apps/frontend/src/app/(app). A missing row for a slug just means
// "no admin override yet, use the page's own hardcoded default", never a
// broken page - every one of these six pages (home/pricing/blog hero
// sections, privacy/terms/contact bodies) fetches this table live on
// every request (force-dynamic) and falls back to its own default JSX
// when no row exists yet, mirroring vantly-ugc.com's Content Management
// page.
export const STATIC_PAGE_SLUGS = [
  'home',
  'pricing',
  'blog',
  'privacy',
  'terms',
  'contact',
] as const;
export type StaticPageSlug = (typeof STATIC_PAGE_SLUGS)[number];

// Real starting content for the BODY-type pages (privacy/terms/contact),
// whose entire content lives in this table's contentHtml column - see
// get-static-page.ts, fetched at request time by
// apps/frontend/src/app/(app)/privacy and .../terms. Lazily seeded on
// first read below rather than via a migration/raw SQL, same pattern
// EmailGroupService/EmailTemplateService already use for their own
// first-run defaults - this repo is Prisma-only, no raw SQL, and a live
// production system shouldn't get a data migration for this.
// home/pricing/blog are deliberately NOT seeded here even though they now
// read live too: those are HERO-type pages whose "default" is the real
// hardcoded JSX already in each page.tsx (headline, subtitle, CTA labels)
// - a seeded DB row would just duplicate that copy and immediately show
// as "Customized" in the admin UI with nothing actually customized.
const DEFAULT_STATIC_PAGE_CONTENT: Partial<
  Record<StaticPageSlug, Pick<StaticPageDto, 'title' | 'contentHtml'>>
> = {
  privacy: {
    title: 'Privacy Policy',
    contentHtml: `<p>
  This Privacy Policy explains what information Vantly (&ldquo;Vantly,&rdquo;
  &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects when you use our social media
  scheduling and management platform at vantly.social (the
  &ldquo;Service&rdquo;), how we use it, who we share it with, and the
  choices you have. By using the Service you agree to the collection and
  use of information as described here.
</p>

<h2>1. Information We Collect</h2>
<p>
  <strong>Account information.</strong> When you register, we collect
  your email address, company/organization name, and a password (stored
  as a salted hash, never in plain text) &mdash; or, if you sign up
  through Google, GitHub, or another identity provider, the basic
  profile details that provider shares with us.
</p>
<p>
  <strong>Connected social accounts.</strong> To schedule and publish
  posts on your behalf, Vantly integrates with third-party platforms
  (including but not limited to LinkedIn, X, Instagram, Facebook,
  TikTok, YouTube, Reddit, Pinterest, Threads, Bluesky, Mastodon,
  Discord, Slack, Telegram, and other supported channels). When you
  connect an account, we receive and store an OAuth access token (and
  refresh token, where the platform provides one), along with basic
  identifying details such as your name, profile photo, and
  page/channel/community ID for that platform. We request only the
  permissions (&ldquo;scopes&rdquo;) needed to publish and manage the
  content you ask us to schedule &mdash; we do not request or use
  permissions beyond that purpose.
</p>
<p>
  <strong>Content you create.</strong> Post captions, scheduled dates
  and times, uploaded images, video, and other media you add to the
  Service.
</p>
<p>
  <strong>Payment information.</strong> If you subscribe to a paid
  plan, billing is handled directly by Stripe, our payment processor.
  Vantly does not receive or store your full card number.
</p>
<p>
  <strong>Usage and device data.</strong> Pages visited, features used,
  approximate location (derived from IP address), browser and device
  type, and similar technical data, collected through analytics tools
  described in Section 3.
</p>
<p>
  <strong>Support and error data.</strong> If the Service encounters an
  error, limited technical diagnostic information (such as a stack
  trace) may be captured automatically to help us fix the issue.
</p>

<h2>2. How We Use Your Information</h2>
<ul>
  <li>To operate the Service: publishing and scheduling content to the accounts you connect, exactly as you direct.</li>
  <li>To authenticate you and keep your account secure.</li>
  <li>To process payments and manage subscriptions, where applicable.</li>
  <li>To send transactional emails (account activation, password resets, notifications about your scheduled posts).</li>
  <li>To understand how the Service is used, in aggregate, so we can improve it.</li>
  <li>To detect, investigate, and prevent fraud, abuse, or security incidents.</li>
  <li>To comply with legal obligations.</li>
</ul>
<p>We do not sell your personal information to third parties.</p>

<h2>3. Analytics and Cookies</h2>
<p>
  We use a small number of analytics and monitoring services to
  understand product usage and diagnose problems: Plausible Analytics
  (a privacy-focused, cookieless analytics tool), PostHog (product
  analytics), Google Tag Manager, Meta/Facebook Pixel, Dub (link
  analytics), Datafa.st, and Sentry (error monitoring). Some of these
  tools use cookies or similar technologies; essential cookies required
  for you to stay logged in are always active, and are not optional.
  Where a tool offers a browser-level opt-out (for example, Google
  Analytics&rsquo; opt-out add-on) or your browser sends a
  Do-Not-Track/Global Privacy Control signal, we honor it where
  technically supported.
</p>

<h2>4. Who We Share Information With</h2>
<p>
  <strong>The platforms you connect.</strong> When you schedule a post,
  we send it to the social platform(s) you selected, using the
  credentials you authorized.
</p>
<p>
  <strong>Service providers.</strong> We rely on a limited set of
  infrastructure and service providers to run Vantly, including hosting
  and database infrastructure, Cloudflare R2 for media storage, an
  email delivery provider for transactional email, Stripe for payment
  processing, and the analytics/monitoring tools listed in Section 3.
  These providers only receive the data needed to perform their
  function for us, and are not permitted to use it for their own
  purposes.
</p>
<p>
  <strong>Legal requirements.</strong> We may disclose information if
  required to do so by law, or in the good-faith belief that doing so
  is necessary to comply with a legal obligation, protect the rights or
  safety of Vantly or our users, or investigate fraud or security
  issues.
</p>

<h2>5. Data Retention</h2>
<p>
  We retain your account information and content for as long as your
  account remains active. Social account tokens are retained until you
  disconnect that integration or delete your account, whichever comes
  first. You can disconnect any connected platform at any time from
  Settings, which revokes our access to that account going forward.
</p>

<h2>6. Your Rights</h2>
<p>
  Depending on where you live, you may have the right to access,
  correct, export, or delete the personal information we hold about
  you, and to object to or restrict certain processing. You can
  exercise most of these rights directly from your account settings;
  for anything else, or to request full account deletion, contact us at 
  <a href="mailto:we@vantly.social">we@vantly.social</a>.
</p>

<h2>7. Security</h2>
<p>
  We use industry-standard measures to protect your information,
  including encryption in transit (HTTPS/TLS) and access controls on
  our infrastructure and databases. No method of transmission or
  storage is 100% secure, and we cannot guarantee absolute security.
</p>

<h2>8. International Data Transfers</h2>
<p>
  Vantly and the service providers we rely on may process data in
  countries other than the one you live in. Where we transfer personal
  data internationally, we take steps to ensure it receives an
  adequate level of protection.
</p>

<h2>9. Children&rsquo;s Privacy</h2>
<p>
  The Service is not directed to children, and we do not knowingly
  collect personal information from anyone under the age of 16. If you
  believe a child has provided us with personal information, please
  contact us and we will delete it.
</p>

<h2>10. Changes to This Policy</h2>
<p>
  We may update this Privacy Policy from time to time. If we make
  material changes, we will update the &ldquo;Last updated&rdquo; date
  above, and where appropriate, notify you by email or through the
  Service.
</p>

<h2>11. Contact Us</h2>
<p>
  Questions about this policy or how we handle your data? Reach us at 
  <a href="mailto:we@vantly.social">we@vantly.social</a>.
</p>`,
  },
  terms: {
    title: 'Terms of Service',
    contentHtml: `<p>
  These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
  use of Vantly, a social media scheduling and management platform
  available at vantly.social (the &ldquo;Service&rdquo;). By creating an
  account or otherwise using the Service, you agree to be bound by
  these Terms. If you are using the Service on behalf of an
  organization, you are agreeing on that organization&rsquo;s behalf and
  confirming you have the authority to do so.
</p>

<h2>1. The Service</h2>
<p>
  Vantly lets you plan, schedule, and publish content to third-party
  social and messaging platforms from a single calendar, along with
  related features such as analytics, team collaboration, and a shared
  media library. Availability of specific platforms and features may
  change over time as we add, adjust, or retire integrations.
</p>

<h2>2. Your Account</h2>
<p>
  You must provide accurate information when registering and keep your
  login credentials confidential. You are responsible for all activity
  that occurs under your account. You must be at least 18 years old, or
  the age of legal majority in your jurisdiction, to create an account.
  Let us know immediately at 
  <a href="mailto:we@vantly.social">we@vantly.social</a> if you suspect
  unauthorized use of your account.
</p>

<h2>3. Connecting Third-Party Platforms</h2>
<p>
  When you connect a social or messaging account (for example
  LinkedIn, X, Instagram, Facebook, TikTok, YouTube, Reddit, or any
  other supported platform), you authorize Vantly to access and act on
  that account strictly as needed to carry out the actions you
  request &mdash; such as publishing a scheduled post. You can revoke
  this access at any time from your Vantly settings and separately
  through the third-party platform&rsquo;s own settings.
</p>
<p>
  Each connected platform has its own terms of service, developer
  policies, and community guidelines, and you remain responsible for
  complying with them. Vantly is not responsible for, and does not
  control, changes, outages, API restrictions, or policy enforcement
  actions taken by third-party platforms, including suspension or
  removal of your account on that platform.
</p>

<h2>4. Acceptable Use</h2>
<p>You agree not to use the Service to:</p>
<ul>
  <li>Post content that is illegal, fraudulent, or infringes someone else&rsquo;s intellectual property or other rights;</li>
  <li>Distribute spam, malware, or engage in any activity that disrupts or abuses connected platforms or their users;</li>
  <li>Violate the terms of service or community guidelines of any platform you connect through Vantly;</li>
  <li>Attempt to gain unauthorized access to the Service, other users&rsquo; accounts, or our infrastructure; or</li>
  <li>Use the Service in any way that violates applicable law.</li>
</ul>
<p>
  We may suspend or terminate accounts that violate this section,
  with or without notice, at our discretion.
</p>

<h2>5. Your Content</h2>
<p>
  You retain ownership of the content you create, upload, and schedule
  through Vantly. By using the Service, you grant us a limited license
  to store, process, and transmit that content solely as needed to
  provide the Service &mdash; for example, publishing it to the
  platforms you&rsquo;ve connected at the time you&rsquo;ve scheduled.
  You are solely responsible for the content you post and for having
  the necessary rights to publish it.
</p>

<h2>6. Subscriptions and Billing</h2>
<p>
  Paid plans, where offered, are billed in advance on a recurring
  basis through Stripe, our payment processor. Unless stated otherwise
  at checkout, subscriptions renew automatically until cancelled. You
  can cancel at any time from your account settings; cancellation
  takes effect at the end of your current billing period, and we do
  not provide partial refunds for unused time except where required
  by law.
</p>

<h2>7. Termination</h2>
<p>
  You may stop using the Service and delete your account at any time.
  We may suspend or terminate your access if you violate these Terms,
  if required by law, or if we discontinue the Service, with
  reasonable notice where practical. Upon termination, your right to
  use the Service ends, though certain provisions of these Terms
  (such as Sections 5, 8, and 9) survive termination.
</p>

<h2>8. Disclaimers</h2>
<p>
  The Service is provided &ldquo;as is&rdquo; and &ldquo;as
  available,&rdquo; without warranties of any kind, whether express or
  implied. We do not guarantee that the Service will be uninterrupted,
  error-free, or that any particular result (such as post reach or
  engagement) will be achieved. We do not control, and are not
  responsible for, the availability, policies, or performance of
  third-party platforms Vantly integrates with.
</p>

<h2>9. Limitation of Liability</h2>
<p>
  To the maximum extent permitted by law, Vantly will not be liable for
  any indirect, incidental, special, consequential, or punitive
  damages, or any loss of profits, data, or goodwill, arising from your
  use of the Service. Our total liability for any claim relating to the
  Service will not exceed the amount you paid us in the twelve months
  preceding the claim.
</p>

<h2>10. Governing Law</h2>
<p>
  These Terms are governed by the laws of the jurisdiction in which
  Vantly is established, without regard to conflict-of-law principles,
  unless a different governing law is required by applicable
  consumer-protection law in your place of residence.
</p>

<h2>11. Changes to These Terms</h2>
<p>
  We may update these Terms from time to time. If we make material
  changes, we will update the &ldquo;Last updated&rdquo; date above and,
  where appropriate, notify you by email or through the Service.
  Continuing to use the Service after changes take effect constitutes
  acceptance of the revised Terms.
</p>

<h2>12. Contact Us</h2>
<p>
  Questions about these Terms? Reach us at 
  <a href="mailto:we@vantly.social">we@vantly.social</a>.
</p>`,
  },
  contact: {
    title: 'Contact Us',
    contentHtml: `<p>
  We&rsquo;d love to hear from you. Whether you have a question about
  features, pricing, your account, or anything else, our team is ready
  to help.
</p>

<h2>Email</h2>
<p>
  The fastest way to reach us is by email at
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
</p>`,
  },
};

@Injectable()
export class StaticPagesService {
  constructor(private _staticPagesRepository: StaticPagesRepository) {}

  private async ensureDefaultSeeded(slug: string) {
    const defaults = DEFAULT_STATIC_PAGE_CONTENT[slug as StaticPageSlug];
    if (!defaults) return;
    const existing = await this._staticPagesRepository.getBySlug(slug);
    if (existing) return;
    await this._staticPagesRepository.upsert(
      slug,
      defaults as StaticPageDto,
      'system:default-seed'
    );
  }

  async getBySlug(slug: string) {
    await this.ensureDefaultSeeded(slug);
    return this._staticPagesRepository.getBySlug(slug);
  }

  async listAll() {
    await Promise.all(
      Object.keys(DEFAULT_STATIC_PAGE_CONTENT).map((slug) =>
        this.ensureDefaultSeeded(slug)
      )
    );
    return this._staticPagesRepository.listAll();
  }

  upsert(slug: StaticPageSlug, body: StaticPageDto, updatedBy: string) {
    return this._staticPagesRepository.upsert(slug, body, updatedBy);
  }

  // "Revert to default" - deletes the override row so the page falls back
  // to its own hardcoded default copy. For privacy/terms this re-seeds on
  // the very next read (ensureDefaultSeeded), which is fine: reverting
  // those two is really "reset to the real default copy", not "go blank".
  revertToDefault(slug: StaticPageSlug) {
    return this._staticPagesRepository.delete(slug);
  }
}
