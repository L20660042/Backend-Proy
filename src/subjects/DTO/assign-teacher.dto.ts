import { IsMongoId, IsNotEmpty, IsArray } from 'class-validator';

export class AssignTeacherDto {
  @IsMongoId()
  @IsNotEmpty()
  teacherId: string;
}

export class AssignTeachersDto {
  @IsArray()
  @IsMongoId({ each: true })
  teacherIds: string[];
}