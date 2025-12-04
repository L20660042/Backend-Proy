// src/auth/auth.service.ts
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto, RegisterDto } from './auth.dto';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import { UserRole } from '../common/enums';


@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.userService.findByEmail(dto.email);
    if (exists) throw new ConflictException('El email ya está registrado');

    const hashed = await bcrypt.hash(dto.password, 10);

    // Normalizar role: si viene como string válido, usarlo; si no, poner ESTUDIANTE por defecto
    let role: UserRole = UserRole.ESTUDIANTE;
    if (dto.role && Object.values(UserRole).includes(dto.role as UserRole)) {
      role = dto.role as UserRole;
    }

    const createDto: CreateUserDto = {
      fullName: dto.name,
      email: dto.email.toLowerCase(),
      password: hashed,
      role,
    };

    const user = await this.userService.create(createDto);

    return {
      message: 'Usuario creado correctamente',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);

    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const match = await bcrypt.compare(dto.password, user.password);

    if (!match) throw new UnauthorizedException('Credenciales inválidas');

    const token = this.jwt.sign({
      _id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user,
    };
  }
}
