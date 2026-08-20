import { IsNotEmpty, IsString } from 'class-validator';

export class PostCommentReplyDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}
