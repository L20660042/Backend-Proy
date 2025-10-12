export class CreateUserDto {
  readonly nombre: string;
  readonly apellido: string;
  readonly correo: string;
  readonly pase: string;
  readonly confirmPassword: string;
  readonly userType: string;
}
