import { IsOptional, IsMongoId, IsString, IsDateString } from 'class-validator';

export class GetReportsDto {
  @IsOptional()
  @IsMongoId()
  userId?: string; // docente o tutor

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

  @IsOptional()
  @IsString()
  type?: 'tutoria' | 'capacitacion' | 'usuarios' | 'grupos' | 'materias';
}
