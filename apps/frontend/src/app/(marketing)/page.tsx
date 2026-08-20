import Link from 'next/link';
import Image from 'next/image';
import { MarketingHeader } from '@gitroom/frontend/components/marketing/marketing-header.component';
import { MarketingFooter } from '@gitroom/frontend/components/marketing/marketing-footer.component';
import { FaqAccordion } from '@gitroom/frontend/components/marketing/faq-accordion.component';
import { MARKETING_PLATFORMS } from '@gitroom/frontend/components/marketing/platform-icons';
import { MARKETING_TIERS } from '@gitroom/frontend/components/marketing/pricing-tiers';

export const dynamic = 'force-static';

const FEATURES = [
  {
    title: 'Schedule everywhere, from one calendar',
    description:
      'Plan and publish to YouTube, X, LinkedIn, Instagram, Facebook, TikTok, Threads, Reddit, Pinterest, Bluesky, Mastodon, Discord, Slack, Telegram and more - all from a single shared calendar, so nothing gets posted twice or forgotten.',
  },
  {
    title: 'An AI Optimizer built for YouTube',
    description:
      'Vantly reviews your channel and surfaces exactly what to fix: AI title rewrites, thumbnail feedback, SEO tag suggestions, and draft replies to unanswered comments - delivered as a live Feed of actionable cards, not a wall of generic advice.',
  },
  {
    title: 'Built for teams, not just individuals',
    description:
      'Invite teammates into a shared workspace, assign who publishes what, and keep every channel&rsquo;s credentials and history in one organization - available from the Team plan up.',
  },
  {
    title: 'Open by design',
    description:
      'A public API and webhooks on every paid plan mean Vantly plugs into the tools you already use, instead of locking your content and data behind a closed dashboard.',
  },
];

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Connect your channels',
    description:
      'Link your social accounts in a few clicks with secure OAuth - Vantly only requests the permissions it needs to publish on your behalf.',
  },
  {
    step: '02',
    title: 'Plan, write, and let AI assist',
    description:
      'Draft posts on a shared calendar and use AI-assisted captions, images, and video where you need a head start - or write everything yourself.',
  },
  {
    step: '03',
    title: 'Publish and keep improving',
    description:
      'Vantly publishes on schedule, then keeps working: the Optimizer Feed flags underperforming titles, thumbnails, and tags so every upload gets a little better than the last.',
  },
];

const HOME_FAQ = [
  {
    question: 'Which social platforms does Vantly support?',
    answer:
      'YouTube, X, LinkedIn, Instagram, Facebook, TikTok, Reddit, Pinterest, Threads, Bluesky, Mastodon, Discord, Slack, Telegram, and more - see the full list on the pricing page or once you sign in.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. Creating a Vantly account is free and does not require a card - you can explore the dashboard before choosing a paid plan to connect channels and start publishing.',
  },
  {
    question: 'Can I cancel or change plans anytime?',
    answer:
      'Yes. Upgrade, downgrade, or cancel anytime from Settings → Billing. Billing is handled directly by Stripe, and you keep access until the end of your current billing period.',
  },
  {
    question: 'What does the AI Optimizer actually do?',
    answer:
      'It reviews your connected YouTube channel and generates specific, ready-to-use suggestions - rewritten titles, thumbnail feedback, SEO tags, and comment reply drafts - shown as cards in your Feed so you can accept, edit, or ignore each one.',
  },
];

export default function MarketingHomePage() {
  return (
    <div className="min-h-screen w-full flex flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-[1200px] mx-auto px-[20px] pt-[88px] pb-[72px] flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-[8px] border border-fifth rounded-full px-[14px] py-[6px] text-[12px] font-[500] text-textColor/70 mb-[24px]">
            <span className="w-[6px] h-[6px] rounded-full bg-ai" />
            Now with an AI Optimizer Feed for YouTube
          </div>
          <h1 className="text-[38px] md:text-[56px] font-[700] leading-[1.1] -tracking-[1px] text-textColor max-w-[820px]">
            Schedule every channel.
            <br />
            Let AI find what to fix.
          </h1>
          <p className="mt-[24px] text-[16px] md:text-[18px] leading-[1.6] text-textColor/70 max-w-[640px]">
            Vantly is the social media scheduling platform with a built-in AI
            Optimizer &mdash; plan and publish everywhere, then let Vantly
            surface the title rewrites, thumbnail fixes, and SEO tags that
            actually move the needle.
          </p>
          <div className="mt-[36px] flex flex-col sm:flex-row items-center gap-[14px]">
            <Link
              href="/auth"
              className="text-[15px] font-[600] bg-btnPrimary text-white rounded-[10px] px-[24px] py-[13px] hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
            <Link
              href="/pricing"
              className="text-[15px] font-[600] text-textColor border border-fifth rounded-[10px] px-[24px] py-[13px] hover:bg-newBgColorInner transition-colors"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-[16px] text-[13px] text-gray">
            No credit card required to sign up.
          </p>
        </section>

        {/* Platform strip */}
        <section id="platforms" className="border-y border-fifth bg-newBgColorInner/40">
          <div className="max-w-[1200px] mx-auto px-[20px] py-[32px]">
            <p className="text-center text-[12px] font-[600] tracking-[1px] text-gray uppercase mb-[24px]">
              Publish everywhere your audience is
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-[36px] gap-y-[20px]">
              {MARKETING_PLATFORMS.map((platform) => (
                <div
                  key={platform.name}
                  className="flex items-center gap-[8px] text-textColor/70"
                  title={platform.name}
                >
                  <Image
                    src={platform.icon}
                    alt={platform.name}
                    width={22}
                    height={22}
                    className="rounded-[5px]"
                  />
                  <span className="text-[13px] font-[500] hidden sm:inline">
                    {platform.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="max-w-[1200px] mx-auto px-[20px] py-[88px]">
          <div className="text-center max-w-[640px] mx-auto mb-[56px]">
            <h2 className="text-[28px] md:text-[36px] font-[700] -tracking-[0.5px] text-textColor">
              Everything you need to run every channel
            </h2>
            <p className="mt-[14px] text-[15px] leading-[1.6] text-textColor/65">
              One calendar, one AI layer, every platform.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[24px]">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[16px] border border-fifth bg-newBgColorInner p-[28px]"
              >
                <h3 className="text-[18px] font-[600] text-textColor mb-[10px]">
                  {feature.title}
                </h3>
                <p className="text-[14px] leading-[1.7] text-textColor/65">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-fifth bg-newBgColorInner/40">
          <div className="max-w-[1200px] mx-auto px-[20px] py-[88px]">
            <div className="text-center max-w-[640px] mx-auto mb-[56px]">
              <h2 className="text-[28px] md:text-[36px] font-[700] -tracking-[0.5px] text-textColor">
                How Vantly works
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-[32px]">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.step} className="flex flex-col">
                  <span className="text-[13px] font-[700] text-ai">
                    {item.step}
                  </span>
                  <h3 className="mt-[10px] text-[17px] font-[600] text-textColor">
                    {item.title}
                  </h3>
                  <p className="mt-[10px] text-[14px] leading-[1.7] text-textColor/65">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing-teaser" className="max-w-[1200px] mx-auto px-[20px] py-[88px]">
          <div className="text-center max-w-[640px] mx-auto mb-[48px]">
            <h2 className="text-[28px] md:text-[36px] font-[700] -tracking-[0.5px] text-textColor">
              Simple, transparent pricing
            </h2>
            <p className="mt-[14px] text-[15px] leading-[1.6] text-textColor/65">
              Start free. Upgrade when you are ready to connect more channels.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-[16px]">
            {MARKETING_TIERS.map((tier) => (
              <Link
                key={tier.key}
                href="/pricing"
                className="rounded-[14px] border border-fifth bg-newBgColorInner p-[20px] hover:border-btnPrimary transition-colors"
              >
                <p className="text-[14px] font-[600] text-textColor">
                  {tier.name}
                </p>
                <p className="mt-[8px] text-[26px] font-[700] text-textColor -tracking-[0.5px]">
                  ${tier.monthPrice}
                  <span className="text-[13px] font-[500] text-gray">
                    /mo
                  </span>
                </p>
                <p className="mt-[4px] text-[12px] text-gray">
                  {tier.channels} channels
                </p>
              </Link>
            ))}
          </div>
          <div className="mt-[32px] flex justify-center">
            <Link
              href="/pricing"
              className="text-[14px] font-[600] text-textColor border border-fifth rounded-[10px] px-[20px] py-[11px] hover:bg-newBgColorInner transition-colors"
            >
              View full pricing &amp; feature comparison &rarr;
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-fifth bg-newBgColorInner/40">
          <div className="max-w-[720px] mx-auto px-[20px] py-[88px]">
            <div className="text-center mb-[40px]">
              <h2 className="text-[28px] md:text-[36px] font-[700] -tracking-[0.5px] text-textColor">
                Frequently asked questions
              </h2>
            </div>
            <FaqAccordion items={HOME_FAQ} />
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-[1200px] mx-auto px-[20px] py-[88px] text-center">
          <h2 className="text-[28px] md:text-[36px] font-[700] -tracking-[0.5px] text-textColor">
            Ready to put your channels on autopilot?
          </h2>
          <p className="mt-[14px] text-[15px] text-textColor/65">
            Create your free account &mdash; no credit card required.
          </p>
          <div className="mt-[28px]">
            <Link
              href="/auth"
              className="inline-block text-[15px] font-[600] bg-btnPrimary text-white rounded-[10px] px-[28px] py-[14px] hover:opacity-90 transition-opacity"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
