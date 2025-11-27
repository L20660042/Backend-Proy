import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AssignSubjectDto {
  @IsMongoId()
  @IsNotEmpty()
  subjectId: string;

  @IsMongoId()
  @IsNotEmpty()
  teacherId: string;

  @IsString()
  @IsOptional()
  schedule?: string;
}