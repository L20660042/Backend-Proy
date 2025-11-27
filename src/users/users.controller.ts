import { Controller, Get, UseGuards, Request, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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
 @Get('profile')
  @UseGuards(JwtAuthGuard)  // Aseguramos que solo los usuarios autenticados puedan acceder
  async getProfile(@Request() req) {
    return this.usersService.getProfile(req.user.id);  // Asegúrate de que `req.user.id` contiene el ID del usuario autenticado
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
          userType: user.user_type,
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