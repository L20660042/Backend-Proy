import { IsEmail, IsString, MinLength, Matches, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  readonly nombre: string;

  @IsString()
  @MinLength(2)
  readonly apellido: string;

  @IsEmail()
  readonly correo: string;

  @IsString()
  @MinLength(8)
  readonly password: string;

  @IsString()
  readonly confirmPassword: string;

  @IsString()
  @IsIn(['estudiante', 'docente', 'administrativo', 'directivo'])
  readonly userType: string;
}