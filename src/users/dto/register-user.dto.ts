import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
export class RegisterUserDto {
  @IsString() firstName: string;  // mapearemos desde "nombre"
  @IsString() lastName: string;   // mapearemos desde "apellido"
  @IsEmail() email: string;       // mapearemos desde "correo"
  @IsString() @MinLength(8) password: string;
  @IsString() userType: 'subdirector-academico'|'jefes-academicos'|'docentes';
} 