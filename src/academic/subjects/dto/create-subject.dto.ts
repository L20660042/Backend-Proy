import { IsInt, IsMongoId, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @MinLength(3)
  name: string;

  @IsString()
  @MinLength(2)
  code: string;

  @IsMongoId()
  careerId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  semester: number;
}
