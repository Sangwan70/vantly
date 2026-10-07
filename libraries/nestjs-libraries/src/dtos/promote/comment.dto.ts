import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class DraftCommentReplyDto {
  @IsString()
  commentId: string;

  @IsOptional()
  @IsIn(['friendly', 'professional', 'playful'])
  tone?: 'friendly' | 'professional' | 'playful';
}

export class SendCommentReplyDto {
  @IsString()
  commentId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2200)
  message: string;
}
