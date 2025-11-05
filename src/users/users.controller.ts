import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('register')
  async register(@Body() body: any) {
    console.log("Datos recibidos para el registro:", body);
    
    // Validar que las contraseñas coincidan
    if (body.password !== body.confirmPassword) {
      throw new BadRequestException('Las contraseñas no coinciden');
    }

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