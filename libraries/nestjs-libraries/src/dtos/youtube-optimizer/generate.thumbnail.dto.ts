import { IsOptional, IsString } from 'class-validator';

export class GenerateThumbnailDto {
  @IsOptional()
  @IsString()
  prompt?: string;
}
