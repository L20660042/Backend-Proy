import { IsString, IsEmail, IsEnum, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum([
    'administrador',
    'jefe-departamento', 
    'docente',
    'tutor',
    'coordinador-tutorias',
    'control-escolar',
    'subdireccion-academica',
    'estudiante'
  ])
  user_type: string;
}