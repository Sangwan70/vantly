import Link from 'next/link';
import { Metadata } from 'next';
import { MarketingHeader } from '@gitroom/frontend/components/marketing/marketing-header.component';
import { MarketingFooter } from '@gitroom/frontend/components/marketing/marketing-footer.component';
import { PricingCards } from '@gitroom/frontend/components/marketing/pricing-cards.component';
import { PricingComparisonTable } from '@gitroom/frontend/components/marketing/pricing-comparison-table.component';
import { FaqAccordion } from '@gitroom/frontend/components/marketing/faq-accordion.component';
import { getStaticPageOverride } from '@gitroom/frontend/components/legal/get-static-page';
import { getMarketingPricingPlans } from '@gitroom/frontend/lib/billing/get-pricing-plans-marketing';
import Image from 'next/image';

// See (marketing)/page.tsx's doc comment on the same change - switched
// from force-static so an admin edit in Content Management (Settings ->
// Content -> Pricing) shows up on the next request instead of only after
// a rebuild.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing - Vantly',
  description:
    'Simple, transparent pricing for Vantly - schedule every social channel and run the AI YouTube Optimizer. Start free, upgrade anytime.',
};

const PRICING_FAQ = [
  {
    question: 'Is there a free plan?',
    answer:
      'Yes. Creating a Vantly account is free and does not require a card - it lets you explore the dashboard before subscribing to a paid plan to connect channels and start publishing.',
  },
  {
    question: 'Can I change plans or cancel anytime?',
    answer:
      'Yes. You can upgrade, downgrade, or cancel from Settings → Billing at any time. Billing is handled directly by Stripe, and you keep access to your current plan until the end of the billing period you already paid for.',
  },
  {
    question: 'What is included in the monthly AI limits?',
    answer:
      'AI image generations, AI video generations, and YouTube Optimizer AI suggestions (title rewrites, SEO tags, thumbnail feedback, comment reply drafts) each have their own monthly allowance per plan, shown in the comparison table above. Core scheduling and publishing are never limited by your plan.',
  },
  {
    question: 'Do you offer annual billing?',
    answer:
      'Yes. Switch the toggle above to Yearly to see the discounted annual rate for any plan, billed once per year instead of monthly.',
  },
  {
    question: 'Which platforms are supported?',
    answer:
      'YouTube, X, LinkedIn, Instagram, Facebook, TikTok, Reddit, Pinterest, Threads, Bluesky, Mastodon, Discord, Slack, Telegram, and more, depending on the connections available on your plan.',
  },
  {
    question: 'Is there a setup fee or long-term contract?',
    answer:
      'No. There are no setup fees and no long-term contracts - every plan is billed monthly or annually and can be cancelled at any time.',
  },
];

export default async function PricingPage() {
  const [override, plans] = await Promise.all([
    getStaticPageOverride('pricing'),
    getMarketingPricingPlans(),
  ]);
  return (
    <div className="min-h-screen w-full flex flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero - overridable from Admin Panel -> Content -> Pricing. */}
        <section className="relative max-w-[1200px] mx-auto px-[20px] pt-[72px] pb-[56px] text-center overflow-hidden rounded-[24px]">
          {(override?.heroImageUrl || override?.heroVideoUrl) && (
            <div className="absolute inset-0 -z-10">
              {override.heroVideoUrl ? (
                <video
                  src={override.heroVideoUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <Image
                  src={override.heroImageUrl!}
                  alt=""
                  fill
                  priority
                  className="object-cover"
                />
              )}
              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: (override.heroOverlayOpacity ?? 45) / 100 }}
              />
            </div>
          )}
          <h1 className="text-[34px] md:text-[48px] font-[700] -tracking-[0.8px] text-textColor">
            {override?.title || 'Simple, transparent pricing'}
          </h1>
          <p className="mt-[16px] text-[16px] leading-[1.6] text-textColor/65 max-w-[560px] mx-auto">
            {override?.contentHtml ||
              'Start free. Upgrade when you need more connected channels, more AI generations, or a team workspace. No hidden fees.'}
          </p>
        </section>

        <section className="max-w-[1200px] mx-auto px-[20px] pb-[88px]">
          <PricingCards plans={plans} />
        </section>

        <section className="border-t border-fifth bg-newBgColorInner/40">
          <div className="max-w-[1000px] mx-auto px-[20px] py-[80px]">
            <div className="text-center max-w-[560px] mx-auto mb-[40px]">
              <h2 className="text-[26px] md:text-[32px] font-[700] -tracking-[0.5px] text-textColor">
                Compare plans
              </h2>
            </div>
            <PricingComparisonTable plans={plans} />
          </div>
        </section>

        <section className="max-w-[720px] mx-auto px-[20px] py-[88px]">
          <div className="text-center mb-[40px]">
            <h2 className="text-[26px] md:text-[32px] font-[700] -tracking-[0.5px] text-textColor">
              Pricing questions
            </h2>
          </div>
          <FaqAccordion items={PRICING_FAQ} />
        </section>

        <section className="max-w-[1200px] mx-auto px-[20px] pb-[96px] text-center">
          <h2 className="text-[26px] md:text-[32px] font-[700] -tracking-[0.5px] text-textColor">
            Still deciding?
          </h2>
          <p className="mt-[12px] text-[15px] text-textColor/65">
            Create a free account and see Vantly with your own channels
            before you subscribe.
          </p>
          <div className="mt-[24px]">
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
