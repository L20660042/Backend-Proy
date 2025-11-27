import { IsOptional, IsString, IsMongoId, IsBoolean, IsEnum } from 'class-validator';

export class FilterSubjectsDto {
  @IsString()
  @IsOptional()
  area?: string;

  @IsEnum(['obligatoria', 'optativa', 'electiva'])
  @IsOptional()
  type?: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsMongoId()
  @IsOptional()
  institution?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}