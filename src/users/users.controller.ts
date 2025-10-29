import { Controller, Post, Body, Logger } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post('send-verification-code')
  async sendVerificationCode(@Body('email') email: string) {
    this.logger.log(`Solicitud de código de verificación para: ${email}`);
    return this.usersService.sendVerificationCode(email);
  }

  @Post('validate-code')
  async validateCode(@Body() body: { email: string; code: string }) {
    this.logger.log(`Validando código para: ${body.email}`);
    return this.usersService.validateVerificationCode(body.email, body.code);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Registrando usuario: ${createUserDto.correo}`);
    return this.usersService.create(createUserDto);
  }
}