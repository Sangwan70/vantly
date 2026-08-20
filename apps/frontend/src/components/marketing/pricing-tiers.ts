// Mirrors libraries/nestjs-libraries/src/database/prisma/subscriptions/pricing.ts
// (the real, authoritative tier data used by the actual billing/checkout
// flow) so the public pricing page never drifts from what customers are
// actually charged. FREE is intentionally left out of the card grid - it
// has no channels/AI/posting enabled and exists as a pre-subscription
// account state, not a usable standalone plan, the same convention the
// existing authenticated billing page (first.billing.component.tsx) uses.
export interface MarketingTier {
  key: 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
  name: string;
  monthPrice: number;
  yearPrice: number;
  channels: number;
  imageGenerations: number;
  videoGenerations: number;
  youtubeAiSuggestions: number;
  webhooks: number;
  teamMembers: boolean;
  autoPost: boolean;
  communityFeatures: boolean;
  features: string[];
}

export const MARKETING_TIERS: MarketingTier[] = [
  {
    key: 'STANDARD',
    name: 'Standard',
    monthPrice: 29,
    yearPrice: 278,
    channels: 5,
    imageGenerations: 20,
    videoGenerations: 3,
    youtubeAiSuggestions: 50,
    webhooks: 2,
    teamMembers: false,
    autoPost: false,
    communityFeatures: false,
    features: [
      '5 connected channels',
      'Unlimited scheduled posts',
      '20 AI image generations / month',
      '3 AI video generations / month',
      '50 YouTube Optimizer AI suggestions / month',
      'Import posts from connected channels',
      'Public API access + 2 webhooks',
    ],
  },
  {
    key: 'TEAM',
    name: 'Team',
    monthPrice: 39,
    yearPrice: 374,
    channels: 10,
    imageGenerations: 100,
    videoGenerations: 10,
    youtubeAiSuggestions: 150,
    webhooks: 10,
    teamMembers: true,
    autoPost: true,
    communityFeatures: true,
    features: [
      'Everything in Standard, plus:',
      '10 connected channels',
      'Team members & shared workspace',
      'Auto-posting',
      'Community engagement features',
      '100 AI image generations / month',
      '10 AI video generations / month',
      '150 YouTube Optimizer AI suggestions / month',
      '10 webhooks',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    monthPrice: 49,
    yearPrice: 470,
    channels: 30,
    imageGenerations: 300,
    videoGenerations: 30,
    youtubeAiSuggestions: 300,
    webhooks: 30,
    teamMembers: true,
    autoPost: true,
    communityFeatures: true,
    features: [
      'Everything in Team, plus:',
      '30 connected channels',
      '300 AI image generations / month',
      '30 AI video generations / month',
      '300 YouTube Optimizer AI suggestions / month',
      '30 webhooks',
    ],
  },
  {
    key: 'ULTIMATE',
    name: 'Ultimate',
    monthPrice: 99,
    yearPrice: 950,
    channels: 100,
    imageGenerations: 500,
    videoGenerations: 60,
    youtubeAiSuggestions: 600,
    webhooks: 10000,
    teamMembers: true,
    autoPost: true,
    communityFeatures: true,
    features: [
      'Everything in Pro, plus:',
      '100 connected channels',
      '500 AI image generations / month',
      '60 AI video generations / month',
      '600 YouTube Optimizer AI suggestions / month',
      '10,000 webhooks',
    ],
  },
];
