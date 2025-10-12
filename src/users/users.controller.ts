import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('send-verification-code')
  async sendVerificationCode(@Body() body: { email: string }) {
    return this.usersService.sendVerificationEmail(body.email);
  }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Post('validate-code')
  async validateCode(@Body() body: { code: string }) {
    return this.usersService.validateCode(body.code); // Validación del código
  }
}
