import { IsString, IsOptional, IsMongoId, IsDateString, IsEnum } from 'class-validator';

export class GenerateReportDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @IsEnum(['tutoria', 'capacitacion', 'usuarios', 'grupos', 'materias', 'completo'])
  type: string;

  @IsOptional()
  @IsEnum(['json', 'csv', 'excel', 'pdf'])
  format?: string;

  @IsOptional()
  @IsMongoId()
  userId?: string;

  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsMongoId()
  careerId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}