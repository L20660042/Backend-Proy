import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { SendCodeDto } from './dto/send-code.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('send-verification-code')
  sendCode(@Body() body: SendCodeDto) {
    return this.users.sendVerificationCode(body.email);
  }

  @Post('validate-code')
  validate(@Body() body: ValidateCodeDto) {
    return this.users.validateCode(body.email, body.code);
  }

  // mapeo de los nombres que tu frontend ya envía
  @Post('register')
  register(@Body() body: any) {
    const dto: RegisterUserDto = {
      firstName: body.nombre,
      lastName: body.apellido,
      email: body.correo,
      password: body.password,       // confirmación ya la validaste en el front
      userType: body.userType,
    };
    return this.users.register(dto);
  }
}
