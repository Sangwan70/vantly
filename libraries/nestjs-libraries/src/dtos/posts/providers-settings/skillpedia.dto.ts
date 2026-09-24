import { IsDefined, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { MediaDto } from '@gitroom/nestjs-libraries/dtos/media/media.dto';
import { Type } from 'class-transformer';

export class SkillpediaDto {
  @IsString()
  @MinLength(2)
  @IsDefined()
  title: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MediaDto)
  main_image?: MediaDto;
}
