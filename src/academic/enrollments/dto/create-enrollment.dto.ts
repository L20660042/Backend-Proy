import { IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateEnrollmentDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  studentId: string;

  @IsMongoId()
  groupId: string;

  @IsOptional()
  @IsIn(['active', 'dropped', 'completed'])
  status?: 'active' | 'dropped' | 'completed';
}
