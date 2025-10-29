import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('send-verification-code')
  sendVerificationCode(@Body('email') email: string) {
    return this.usersService.sendVerificationCode(email);
  }

  @Post('validate-code')
  validateCode(@Body() body: { email: string; code: string }) {
    return this.usersService.validateVerificationCode(body.email, body.code);
  }

  @Post('register')
  register(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }
}
