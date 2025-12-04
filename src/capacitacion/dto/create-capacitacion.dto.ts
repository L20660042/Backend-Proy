import { IsNotEmpty, IsString, IsMongoId, IsDateString, IsOptional, IsArray } from 'class-validator';

export class CreateCapacitacionDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsMongoId()
  teacher: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evidence?: string[];

  @IsOptional()
  @IsString()
  observations?: string;
}
