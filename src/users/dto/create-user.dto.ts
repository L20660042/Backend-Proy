import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsArray()
  @IsString({ each: true })
  roles: string[];

  @IsOptional()
  @IsIn(['active', 'disabled', 'pending'])
  status?: 'active' | 'disabled' | 'pending';

  @IsOptional()
  @IsString()
  linkedEntityId?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  teacherName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  employeeNumber?: string;
}
