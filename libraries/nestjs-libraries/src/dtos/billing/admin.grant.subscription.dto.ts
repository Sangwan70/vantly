import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

// Admin Panel -> Users -> Plan. A complimentary grant: written straight to
// the organization's Subscription row, no payment gateway involved.
export class AdminGrantSubscriptionDto {
  @IsString()
  organizationId: string;

  @IsIn(['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'])
  tier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';

  @IsIn(['MONTHLY', 'YEARLY'])
  period: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsBoolean()
  isLifetime?: boolean;

  // Optional override; defaults to the tier's channel limit from the
  // Plans & Pricing table when omitted.
  @IsOptional()
  @IsInt()
  @Min(0)
  totalChannels?: number;
}
