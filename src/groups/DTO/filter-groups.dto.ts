import { IsOptional, IsString, IsMongoId, IsBoolean } from 'class-validator';

export class FilterGroupsDto {
  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  semester?: string;

  @IsString()
  @IsOptional()
  shift?: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsMongoId()
  @IsOptional()
  tutor?: string;

  @IsMongoId()
  @IsOptional()
  student?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}