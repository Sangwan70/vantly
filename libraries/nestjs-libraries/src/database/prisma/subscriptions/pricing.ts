export interface PricingInnerInterface {
  current: string;
  month_price: number;
  year_price: number;
  // Optional INR display prices for the RazorPay gateway (PAYMENT_GATEWAY=
  // razorpay) - deliberately left undefined here rather than derived via a
  // conversion rate, since the real number that matters is whatever amount
  // was baked into the corresponding RAZORPAY_{TIER}_PLAN_{PERIOD} Plan in
  // the RazorPay Dashboard. Fill these in per-tier to match your real Plan
  // amounts if you want the pricing UI to show INR instead of "billed in
  // INR - final price shown at checkout".
  inr_month_price?: number;
  inr_year_price?: number;
  channel?: number;
  posts_per_month: number;
  team_members: boolean;
  community_features: boolean;
  featured_by_gitroom: boolean;
  ai: boolean;
  import_from_channels: boolean;
  image_generator?: boolean;
  image_generation_count: number;
  generate_videos: number;
  // YouTube Optimizer: shared pool for every non-image AI generation in the
  // optimizer - title-rewrite/SEO suggestions (Phase 2), comment-reply
  // drafting (Phase 4), and video review critiques (Phase 5, the priciest of
  // the four since it's a full-transcript prompt). All gpt-4.1 chat
  // completions, no image generation involved, so one pool keeps the pricing
  // config simple rather than splitting into per-feature counters. Values
  // are a starting assumption, not a confirmed business decision - adjust
  // freely (and reconsider a per-feature split if video review's heavier
  // token cost turns out to need its own limit).
  youtube_text_suggestions: number;
  public_api: boolean;
  webhooks: number;
  autoPost: boolean;
}
export interface PricingInterface {
  [key: string]: PricingInnerInterface;
}
export const pricing: PricingInterface = {
  FREE: {
    current: 'FREE',
    month_price: 0,
    year_price: 0,
    channel: 0,
    image_generation_count: 0,
    posts_per_month: 0,
    team_members: false,
    community_features: false,
    featured_by_gitroom: false,
    ai: false,
    import_from_channels: false,
    image_generator: false,
    public_api: false,
    webhooks: 0,
    autoPost: false,
    generate_videos: 0,
    youtube_text_suggestions: 0,
  },
  STANDARD: {
    current: 'STANDARD',
    month_price: 29,
    year_price: 278,
    channel: 5,
    posts_per_month: 1000000,
    image_generation_count: 20,
    team_members: false,
    ai: true,
    community_features: false,
    featured_by_gitroom: false,
    import_from_channels: true,
    image_generator: false,
    public_api: true,
    webhooks: 2,
    autoPost: false,
    generate_videos: 3,
    youtube_text_suggestions: 50,
  },
  TEAM: {
    current: 'TEAM',
    month_price: 39,
    year_price: 374,
    channel: 10,
    posts_per_month: 1000000,
    image_generation_count: 100,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 10,
    autoPost: true,
    generate_videos: 10,
    youtube_text_suggestions: 150,
  },
  PRO: {
    current: 'PRO',
    month_price: 49,
    year_price: 470,
    channel: 30,
    posts_per_month: 1000000,
    image_generation_count: 300,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 30,
    autoPost: true,
    generate_videos: 30,
    youtube_text_suggestions: 300,
  },
  ULTIMATE: {
    current: 'ULTIMATE',
    month_price: 99,
    year_price: 950,
    channel: 100,
    posts_per_month: 1000000,
    image_generation_count: 500,
    community_features: true,
    team_members: true,
    featured_by_gitroom: true,
    ai: true,
    import_from_channels: true,
    image_generator: true,
    public_api: true,
    webhooks: 10000,
    autoPost: true,
    generate_videos: 60,
    youtube_text_suggestions: 600,
  },
};
