import { IsIn, IsInt, IsMongoId, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateScheduleBlockDto {
  @IsMongoId()
  periodId: string;

  @IsIn(['class', 'extracurricular'])
  type: 'class' | 'extracurricular';

  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek: number;

  // HH:MM
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  startTime: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  endTime: string;

  @IsOptional()
  @IsString()
  room?: string;

  
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsMongoId()
  subjectId?: string;

  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  
  @IsOptional()
  @IsMongoId()
  activityId?: string;
}
