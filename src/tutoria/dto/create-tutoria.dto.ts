import { IsNotEmpty, IsString, IsMongoId, IsDateString, IsOptional, IsBoolean } from 'class-validator';

export class CreateTutoriaDto {
  @IsNotEmpty()
  @IsMongoId()
  tutor: string;

  @IsNotEmpty()
  @IsMongoId()
  student: string;

  @IsNotEmpty()
  @IsMongoId()
  group: string;

  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  topics?: string;

  @IsOptional()
  @IsString()
  agreements?: string;

  @IsOptional()
  @IsString()
  observations?: string;

  @IsOptional()
  @IsBoolean()
  riskDetected?: boolean;

  @IsOptional()
  followUps?: string[];
}
