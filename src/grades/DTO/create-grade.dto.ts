import { 
  IsString, 
  IsNotEmpty, 
  IsNumber, 
  Min, 
  Max, 
  IsMongoId, 
  IsOptional, 
  IsEnum 
} from 'class-validator';

export class CreateGradeDto {
  @IsMongoId()
  @IsNotEmpty()
  student: string;

  @IsMongoId()
  @IsNotEmpty()
  subject: string;

  @IsMongoId()
  @IsNotEmpty()
  group: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  score: number;

  @IsEnum(['primero', 'segundo', 'tercero', 'extraordinario', 'final'])
  @IsNotEmpty()
  period: string;

  @IsString()
  @IsOptional()
  comments?: string;
}