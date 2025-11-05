import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { SendCodeDto } from './dto/send-code.dto';
import { ValidateCodeDto } from './dto/validate-code.dto';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

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
