import { IsMongoId } from 'class-validator';

export class GetTeacherScheduleDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  teacherId: string;
}

export class GetGroupScheduleDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  groupId: string;
}

export class GetStudentScheduleDto {
  @IsMongoId()
  periodId: string;

  @IsMongoId()
  studentId: string;
}
