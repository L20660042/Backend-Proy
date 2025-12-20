import { IsInt, IsMongoId, IsString, Max, Min, MinLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsMongoId()
  careerId: string;

  @IsMongoId()
  periodId: string;

  @IsInt()
  @Min(1)
  @Max(20)
  semester: number;
}
