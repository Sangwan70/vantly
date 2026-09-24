import { IsDefined, IsString, MinLength } from 'class-validator';

export class SkillpediaDto {
  @IsString()
  @MinLength(2)
  @IsDefined()
  title: string;
}
