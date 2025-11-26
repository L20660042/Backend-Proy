import { IsArray, IsNumber, IsString, IsOptional, Min, Max, ArrayMinSize } from 'class-validator';

export class StudentRiskAnalysisDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  grades: number[];

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  attendance: number[];

  @IsNumber()
  @Min(0)
  tutoring_sessions: number;

  @IsArray()
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(5, { each: true })
  evaluation_scores: number[];

  @IsOptional()
  @IsString()
  student_id?: string;
}

export class FeedbackAnalysisDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  student_id?: string;

  @IsOptional()
  @IsString()
  teacher_id?: string;
}