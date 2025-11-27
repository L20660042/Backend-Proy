import { 
  IsString, 
  IsNotEmpty, 
  IsOptional, 
  IsMongoId, 
  IsArray, 
  IsNumber, 
  Min,
  IsBoolean
} from 'class-validator';

class AssignedSubjectDto {
  @IsMongoId()
  @IsNotEmpty()
  subject: string;

  @IsMongoId()
  @IsNotEmpty()
  teacher: string;

  @IsString()
  @IsOptional()
  schedule?: string;
}

export class CreateGroupDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  grade?: string;

  @IsString()
  @IsOptional()
  level?: string;

  @IsString()
  @IsOptional()
  semester?: string;

  @IsString()
  @IsOptional()
  shift?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsMongoId()
  @IsOptional()
  tutor?: string;

  @IsMongoId()
  @IsOptional()
  headTeacher?: string;

  @IsArray()
  @IsOptional()
  students?: string[];

  @IsArray()
  @IsOptional()
  teachers?: string[];

  @IsArray()
  @IsOptional()
  assignedSubjects?: AssignedSubjectDto[];
}