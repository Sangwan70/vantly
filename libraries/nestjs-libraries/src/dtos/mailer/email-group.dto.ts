import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class EmailGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['MANUAL', 'ALL_USERS', 'SMART'])
  type: 'MANUAL' | 'ALL_USERS' | 'SMART';

  @IsOptional()
  @IsArray()
  memberEmails?: string[];

  // e.g. { hasSubscription: true } / { hasSubscription: false } - see
  // mailer-recipients.service.ts's resolveGroup() for every rule it
  // understands.
  @IsOptional()
  @IsObject()
  smartRules?: Record<string, unknown>;
}
