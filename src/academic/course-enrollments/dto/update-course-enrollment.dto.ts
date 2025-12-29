import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCourseEnrollmentDto {
  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';

    @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  finalGrade?: number | null;
}
