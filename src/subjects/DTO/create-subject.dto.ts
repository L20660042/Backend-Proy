import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsMongoId, 
  IsNumber, 
  Min, 
  IsEnum 
} from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(1)
  @IsNotEmpty()
  credits: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  hoursPerWeek?: number;

  @IsEnum(['obligatoria', 'optativa', 'electiva'])
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  area?: string;

  @IsMongoId()
  @IsOptional()
  assignedTeacher?: string;

  @IsMongoId({ each: true })
  @IsOptional()
  availableTeachers?: string[];
}