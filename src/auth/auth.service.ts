import { BadRequestException, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { Role } from './roles.enum';
import { StudentsService } from 'src/academic/students/students.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService, private students: StudentsService) {}

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    if (user.status !== 'active') {
      throw new ForbiddenException('Usuario no activo');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciales inválidas');

    const payload = {
      sub: String(user._id),
      email: user.email,
      roles: user.roles,
      status: user.status,
      linkedEntityId: user.linkedEntityId ?? null,
    };

    return {
      access_token: await this.jwt.signAsync(payload),
      user: { id: String(user._id), email: user.email, roles: user.roles },
    };
  }

 async registerStudent(controlNumber: string, password: string) {
  const cn = String(controlNumber ?? '').trim();
  const pass = String(password ?? '').trim();

  if (!/^\d{8}$/.test(cn)) throw new BadRequestException('controlNumber debe tener 8 dígitos');
  if (!pass || pass.length < 6) throw new BadRequestException('password mínimo 6 caracteres');

  const email = `l${cn}@matehuala.tecnm.mx`.toLowerCase();

  const existsUser = await this.users.findByEmail(email);
  if (existsUser) throw new BadRequestException('Ya existe una cuenta con este número de control');

  // ✅ Si ya existe el alumno en students, lo ligamos automáticamente
  const student = await this.students.findByControlNumber(cn);

  await this.users.create({
    email,
    password: pass,
    roles: [Role.ALUMNO],
    status: 'pending',
    linkedEntityId: student ? String((student as any)._id) : null,
  } as any);

  return {
    message: student
      ? 'Registro creado. Cuenta en pending; ya quedó ligado al alumno en catálogo.'
      : 'Registro creado. Cuenta en pending; Control Escolar debe capturar tu alumno en catálogo y ligar la cuenta.',
    email,
    status: 'pending',
    linked: !!student,
  };
}

  // ✅ Cambiar password del usuario logueado (requiere password actual)
  async changePassword(userId: string, email: string, currentPassword: string, newPassword: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    if (String(user._id) !== String(userId)) throw new UnauthorizedException('Token inválido');

    const ok = await bcrypt.compare(String(currentPassword ?? ''), user.passwordHash);
    if (!ok) throw new UnauthorizedException('Contraseña actual incorrecta');

    const newPass = String(newPassword ?? '').trim();
    if (!newPass || newPass.length < 6) throw new BadRequestException('newPassword mínimo 6 caracteres');

    await this.users.update(String(user._id), { password: newPass } as any);

    return { message: 'Contraseña actualizada' };
  }
}
