import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertUserDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];

  @IsOptional()
  @IsIn(['active', 'inactive', 'pending'])
  status?: 'active' | 'inactive' | 'pending';

  @IsOptional()
  @IsString()
  linkedEntityId?: string | null;

  @IsOptional()
  @IsString()
  teacherName?: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;
}
