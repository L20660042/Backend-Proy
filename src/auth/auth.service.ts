import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private users: UsersService, private jwt: JwtService) {}

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
}
