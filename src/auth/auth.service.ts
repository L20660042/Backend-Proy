import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SystemRole } from './roles.enum';
import { UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // Registro (si decides permitirlo desde la API)
  async register(dto: CreateUserDto) {
    const user = await this.usersService.create({
      ...dto,
      roles: dto.roles?.length ? dto.roles : [SystemRole.ALUMNO],
    });

    // user es UserDocument -> usamos _id
    const userId = (user._id as unknown as string).toString();

    return this.buildToken(userId, user.username, user.roles);
  }

  async validateUser(username: string, pass: string): Promise<UserDocument> {
    const user = await this.usersService.findByUsername(username);
    if (!user || !user.active) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos');
    }

    return user;
  }

  async login(username: string, pass: string) {
    const user = await this.validateUser(username, pass);

    const userId = (user._id as unknown as string).toString();

    return this.buildToken(userId, user.username, user.roles);
  }

  private buildToken(userId: string, username: string, roles: SystemRole[]) {
    const payload = { sub: userId, username, roles };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
