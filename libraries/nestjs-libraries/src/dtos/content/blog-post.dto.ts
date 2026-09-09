import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BlogPostDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  coverImageUrl?: string;

  @IsString()
  contentHtml: string;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  seoDescription?: string;
}
