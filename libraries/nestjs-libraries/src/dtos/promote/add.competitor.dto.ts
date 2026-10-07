import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

// Instagram usernames: letters, numbers, periods and underscores, max 30.
export class AddCompetitorDto {
  @IsString()
  @MinLength(1)
  @MaxLength(31)
  @Matches(/^@?[A-Za-z0-9._]{1,30}$/, {
    message: 'Enter a valid Instagram username',
  })
  username: string;
}
