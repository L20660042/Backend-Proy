import { IsArray, IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsArray()
  @IsString({ each: true })
  roles: string[]; // ejemplo: ["SUPERADMIN"] | ["DOCENTE"] | ["ALUMNO"]

  @IsOptional()
  @IsIn(['active', 'disabled', 'pending'])
  status?: 'active' | 'disabled' | 'pending';

  @IsOptional()
  @IsString()
  linkedEntityId?: string;
}
