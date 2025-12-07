import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateCareerDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;
}