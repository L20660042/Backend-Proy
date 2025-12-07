import { IsString, IsMongoId, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsMongoId()
  career: string;

  @IsOptional()
  @IsMongoId()
  teacher?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  credits?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  semester?: number;
}