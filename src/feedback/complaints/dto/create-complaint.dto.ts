import { IsEnum, IsMongoId, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeacherComplaintDto {
  @IsMongoId()
  periodId: string;

  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  @IsOptional()
  @IsMongoId()
  classAssignmentId?: string;

  @IsEnum(['trato', 'impuntualidad', 'evaluacion_injusta', 'incumplimiento', 'acoso', 'otro'] as any)
  category: 'trato' | 'impuntualidad' | 'evaluacion_injusta' | 'incumplimiento' | 'acoso' | 'otro';

  @IsString()
  @MaxLength(2000)
  description: string;
}
