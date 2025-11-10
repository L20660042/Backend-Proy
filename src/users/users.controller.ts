import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './DTO/create-user.dto';
import { LoginDto } from './DTO/login.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Endpoint para registro de usuarios
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      return await this.usersService.create(createUserDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error en el registro',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  // Endpoint para login 
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      console.log('Solicitud de login recibida para:', loginDto.email);
      const { user, token } = await this.usersService.validateUserPassword(
        loginDto.email, 
        loginDto.password
      );

      return {
        success: true,
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          userType: user.userType,
        },
      };
    } catch (error) {
      console.error('Error en login:', error.message);
      throw new HttpException(
        { 
          success: false,
          error: error.message 
        },
        HttpStatus.UNAUTHORIZED
      );
    }
  }
}