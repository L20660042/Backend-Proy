import { IsMongoId, IsNotEmpty, IsArray } from 'class-validator';

export class AssignStudentDto {
  @IsMongoId()
  @IsNotEmpty()
  studentId: string;
}

export class AssignStudentsDto {
  @IsArray()
  @IsMongoId({ each: true })
  studentIds: string[];
}