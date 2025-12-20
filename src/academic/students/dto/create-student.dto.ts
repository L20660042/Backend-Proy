import { IsIn, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @MinLength(4)
  controlNumber: string;

  @IsString()
  @MinLength(3)
  name: string;

  @IsMongoId()
  careerId: string;

  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsIn(['active', 'inactive', 'suspended'])
  status?: 'active' | 'inactive' | 'suspended';
}
