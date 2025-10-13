import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Enviar código de verificación
  @Post('send-verification-code')
  async sendVerificationCode(@Body() body: { correo: string }) {
    return this.usersService.sendVerificationEmail(body.correo);
  }

  // Validar código de verificación
  @Post('validate-code')
  async validateCode(@Body() body: { correo: string; code: string }) {
    const isValid = await this.usersService.validateCode(body.correo, body.code);
    if (isValid) {
      return { message: 'Código de verificación válido' };
    } else {
      return { message: 'Código inválido o expirado' };
    }
  }

  // Registro final del usuario
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
