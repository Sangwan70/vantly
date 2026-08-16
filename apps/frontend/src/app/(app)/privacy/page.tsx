import { LegalPageLayout } from '@gitroom/frontend/components/legal/legal-page-layout.component';

export const dynamic = 'force-static';

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="August 16, 2026">
      <p>
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
        for anything else, or to request full account deletion, contact us at{' '}
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
        Questions about this policy or how we handle your data? Reach us at{' '}
        <a href="mailto:we@vantly.social">we@vantly.social</a>.
      </p>
    </LegalPageLayout>
  );
}
