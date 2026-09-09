import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// Update payload for one tier's row (PUT /admin/pricing-plans/:tier).
// `tier` itself is never editable here - it's the fixed route param that
// identifies which of the 5 known rows to update, matching
// STATIC_PAGE_SLUGS's "fixed set, no create/delete" convention in
// static-page.dto.ts's sibling controller.
export class PricingPlanDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  badge?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  channel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  postsPerMonth?: number;

  @IsOptional()
  @IsBoolean()
  teamMembers?: boolean;

  @IsOptional()
  @IsBoolean()
  communityFeatures?: boolean;

  @IsOptional()
  @IsBoolean()
  featuredByGitroom?: boolean;

  @IsOptional()
  @IsBoolean()
  ai?: boolean;

  @IsOptional()
  @IsBoolean()
  importFromChannels?: boolean;

  @IsOptional()
  @IsBoolean()
  imageGenerator?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  imageGenerationCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  generateVideos?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  youtubeTextSuggestions?: number;

  @IsOptional()
  @IsBoolean()
  publicApi?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  webhooks?: number;

  @IsOptional()
  @IsBoolean()
  autoPost?: boolean;

  // Blank string clears the DB override and falls back to the matching
  // RAZORPAY_{TIER}_PLAN_{PERIOD} env var - see
  // PricingPlansService.resolveRazorpayPlanId().
  @IsOptional()
  @IsString()
  razorpayPlanIdMonthly?: string;

  @IsOptional()
  @IsString()
  razorpayPlanIdYearly?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPurchasable?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;
}
