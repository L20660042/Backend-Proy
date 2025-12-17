import {
  IsString,
  MinLength,
  IsOptional,
  IsEmail,
  IsArray,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { SystemRole } from '../../auth/roles.enum';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsArray()
  @IsEnum(SystemRole, { each: true })
  @IsOptional()
  roles?: SystemRole[];

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
