import { IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateCourseEnrollmentDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  studentId: string;

  @IsMongoId()
  classAssignmentId: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
