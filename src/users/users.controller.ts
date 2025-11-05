import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // mapeo de los nombres que tu frontend ya envía
  @Post('register')
register(@Body() body: any) {
  console.log("Datos recibidos para el registro:", body); // Log para depuración
  const dto: RegisterUserDto = {
    firstName: body.nombre,
    lastName: body.apellido,
    email: body.correo,
    password: body.password,
    userType: body.userType,
  };
  return this.users.register(dto);
}
}
