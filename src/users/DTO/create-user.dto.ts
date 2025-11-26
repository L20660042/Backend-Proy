export class CreateUserDto {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  userType: 'administrador-general' | 'jefe-departamento' | 'docente' | 'tutor' | 'coordinador-tutorias' | 'control-escolar' | 'subdireccion-academica';
  institution?: string;
}