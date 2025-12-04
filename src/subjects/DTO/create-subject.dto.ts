import { IsString, IsMongoId, IsOptional } from 'class-validator';

export class CreateSubjectDto {
  @IsString()
  name: string;

  @IsMongoId()
  career: string;

  @IsString()
  @IsOptional()
  code?: string; 
}
