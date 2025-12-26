import { IsIn, IsOptional } from 'class-validator';

export class UpdateCourseEnrollmentDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
