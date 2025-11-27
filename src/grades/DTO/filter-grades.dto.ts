import { IsEnum, IsOptional, IsMongoId } from 'class-validator';

export class FilterGradesDto {
  @IsMongoId()
  @IsOptional()
  student?: string;

  @IsMongoId()
  @IsOptional()
  subject?: string;

  @IsMongoId()
  @IsOptional()
  group?: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsEnum(['primero', 'segundo', 'tercero', 'extraordinario', 'final'])
  @IsOptional()
  period?: string;

  @IsMongoId()
  @IsOptional()
  institution?: string;
}