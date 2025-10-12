import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('send-verification-code')
  async sendVerificationCode(@Body() body: { correo: string }) {
    return this.usersService.sendVerificationEmail(body.correo);
  }

  @Post('validate-code')
  async validateCode(@Body() body: { code: string }) {
    const isValid = await this.usersService.validateCode(body.code);  // Llamada al método validateCode
    if (isValid) {
      return { message: 'Código de verificación válido' };
    } else {
      return { message: 'Código de verificación inválido' };
    }
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
