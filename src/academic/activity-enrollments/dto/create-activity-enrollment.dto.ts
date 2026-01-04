import { IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateActivityEnrollmentDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  studentId: string;

  @IsMongoId()
  activityId: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
