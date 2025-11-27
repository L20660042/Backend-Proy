import { IsEnum, IsOptional, IsMongoId } from 'class-validator';

export class FilterComplaintsDto {
  @IsEnum(['queja', 'evaluacion', 'sugerencia', 'reclamo'])
  @IsOptional()
  type?: string;

  @IsEnum(['pendiente', 'en_revision', 'resuelta', 'rechazada'])
  @IsOptional()
  status?: string;

  @IsEnum(['pedagogica', 'conducta', 'evaluacion', 'metodologia', 'otro'])
  @IsOptional()
  category?: string;

  @IsMongoId()
  @IsOptional()
  teacher?: string;

  @IsMongoId()
  @IsOptional()
  student?: string;

  @IsOptional()
  @IsMongoId()
  institution?: string;
}