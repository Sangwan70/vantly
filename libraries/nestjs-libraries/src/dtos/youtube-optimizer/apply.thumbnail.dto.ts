import { IsNotEmpty, IsString } from 'class-validator';

export class ApplyThumbnailDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;
}
