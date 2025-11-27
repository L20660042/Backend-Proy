import { PartialType } from '@nestjs/mapped-types';
import { CreateGradeDto } from './create-grade.dto';
import { IsNumber, Min, Max, IsOptional, IsEnum } from 'class-validator';

export class UpdateGradeDto extends PartialType(CreateGradeDto) {
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  score?: number;

  @IsEnum(['primero', 'segundo', 'tercero', 'extraordinario', 'final'])
  @IsOptional()
  period?: string;

  @IsOptional()
  comments?: string;
}