import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Hashtags: letters, numbers and underscores (any language), optional #.
export class ResearchHashtagDto {
  @IsString()
  @MinLength(1)
  @MaxLength(101)
  @Matches(/^#?[\p{L}\p{N}_]{1,100}$/u, {
    message: 'Hashtags can only contain letters, numbers and underscores',
  })
  hashtag: string;

  // Bypass the 24h result cache. Still counts as the same unique hashtag for
  // Meta's weekly cap if it was already looked up this week.
  @IsOptional()
  @IsBoolean()
  refresh?: boolean;
}

export class SuggestHashtagsDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  topic: string;
}

export class SaveHashtagSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  hashtags: string[];
}
