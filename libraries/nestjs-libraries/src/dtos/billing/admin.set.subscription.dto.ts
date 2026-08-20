import { IsBoolean, IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class AdminSetSubscriptionDto {
  @IsIn(['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'])
  tier: 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';

  @IsInt()
  @Min(0)
  totalChannels: number;

  @IsIn(['MONTHLY', 'YEARLY'])
  period: 'MONTHLY' | 'YEARLY';

  @IsOptional()
  @IsBoolean()
  isLifetime?: boolean;
}
