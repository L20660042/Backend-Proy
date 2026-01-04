import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, Max, Min, ValidateNested } from 'class-validator';

export class UnitGradesDto {
  @IsOptional() @IsNumber() @Min(0) @Max(100) u1?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) u2?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) u3?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) u4?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) u5?: number;
}

export class UpdateCourseEnrollmentGradesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UnitGradesDto)
  unitGrades?: UnitGradesDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  finalGrade?: number;

  @IsOptional()
  @IsBoolean()
  computeFinal?: boolean;
}
