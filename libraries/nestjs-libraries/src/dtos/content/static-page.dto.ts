import { IsNumber, IsOptional, IsString } from 'class-validator';

export class StaticPageDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  contentHtml?: string;

  @IsOptional()
  @IsString()
  heroImageUrl?: string;

  @IsOptional()
  @IsString()
  heroVideoUrl?: string;

  @IsOptional()
  @IsNumber()
  heroOverlayOpacity?: number;

  @IsOptional()
  @IsString()
  ctaPrimaryText?: string;

  @IsOptional()
  @IsString()
  ctaSecondaryText?: string;
}
