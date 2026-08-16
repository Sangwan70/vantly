import { LegalPageLayout } from '@gitroom/frontend/components/legal/legal-page-layout.component';

export const dynamic = 'force-static';

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" lastUpdated="August 16, 2026">
      <p>
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
        Let us know immediately at{' '}
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
        Questions about these Terms? Reach us at{' '}
        <a href="mailto:we@vantly.social">we@vantly.social</a>.
      </p>
    </LegalPageLayout>
  );
}
