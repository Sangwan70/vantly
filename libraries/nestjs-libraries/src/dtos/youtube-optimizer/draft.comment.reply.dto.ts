import { IsNotEmpty, IsString } from 'class-validator';

export class DraftCommentReplyDto {
  @IsString()
  @IsNotEmpty()
  commentText: string;
}
