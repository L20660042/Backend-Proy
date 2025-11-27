import { IsString, IsNotEmpty, IsOptional, IsEnum, IsBoolean, IsNumber, Min, Max, IsMongoId } from 'class-validator';

export class CreateComplaintDto {
  @IsMongoId()
  @IsNotEmpty()
  teacher: string;

  @IsMongoId()
  @IsOptional()
  subject?: string;

  @IsMongoId()
  @IsOptional()
  group?: string;

  @IsEnum(['queja', 'evaluacion', 'sugerencia', 'reclamo'])
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(['pedagogica', 'conducta', 'evaluacion', 'metodologia', 'otro'])
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsBoolean()
  @IsOptional()
  isAnonymous?: boolean;
}