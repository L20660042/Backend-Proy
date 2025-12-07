import { PartialType } from '@nestjs/mapped-types';
import { CreateCareerDto } from './create-career.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateCareerDto extends PartialType(CreateCareerDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
  
  // También permitir status para el frontend
  @IsOptional()
  status?: string;
}