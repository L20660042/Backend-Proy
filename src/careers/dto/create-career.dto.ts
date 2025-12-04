import { IsString, IsOptional } from 'class-validator';

export class CreateCareerDto {
  @IsString()
  name: string;

  @IsString()
  code: string; 

  @IsOptional()
  description?: string;
}
