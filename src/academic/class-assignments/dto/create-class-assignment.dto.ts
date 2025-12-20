import { IsIn, IsMongoId, IsOptional } from 'class-validator';

export class CreateClassAssignmentDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  careerId: string;

  @IsMongoId()
  groupId: string;

  @IsMongoId()
  subjectId: string;

  @IsMongoId()
  teacherId: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
