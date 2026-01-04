import { ArrayMinSize, IsMongoId, IsOptional, IsString } from 'class-validator';

export class BulkActivityEnrollmentDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  activityId: string;

  @ArrayMinSize(1)
  studentIds: string[];

  @IsOptional()
  @IsString()
  status?: 'active' | 'inactive';
}
