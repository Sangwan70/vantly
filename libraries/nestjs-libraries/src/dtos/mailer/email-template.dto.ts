import { IsNotEmpty, IsString } from 'class-validator';

export class EmailTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  htmlContent: string;
}
