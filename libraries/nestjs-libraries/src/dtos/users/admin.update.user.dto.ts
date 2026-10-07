import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Admin Panel -> Users -> Edit. Every field is optional so the same
// endpoint can be used for a partial edit; only fields present are changed.
export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsBoolean()
  sendSuccessEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  sendFailureEmails?: boolean;

  @IsOptional()
  @IsBoolean()
  sendStreakEmails?: boolean;
}
