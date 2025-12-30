import { IsMongoId, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTeacherEvaluationDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  classAssignmentId: string;

  @IsObject()
  ratings: Record<string, number>;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  comment?: string;
}
