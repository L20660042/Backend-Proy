import { IsEmail, IsIn, IsString, MinLength, Validate } from 'class-validator';

export class RegisterUserDto {
  @IsString()
  @MinLength(2)
  readonly firstName: string;

  @IsString()
  @MinLength(2)
  readonly lastName: string;

  @IsEmail()
  readonly email: string;

  @IsString()
  @MinLength(8)
  readonly password: string;

  @IsString()
  @IsIn(['subdirector-academico', 'jefes-academicos', 'docentes'])
  readonly userType: string;
}