import { Controller, Get, UseGuards, Request, Post, Body, HttpException, HttpStatus, Put } from '@nestjs/common';
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
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    try {
      return await this.usersService.getProfile(req.user.userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener perfil',
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

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateData: any) {
    try {
      return await this.usersService.updateProfile(req.user.userId, updateData);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al actualizar perfil',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Put('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() body: { currentPassword: string, newPassword: string }) {
    try {
      return await this.usersService.changePassword(
        req.user.userId,
        body.currentPassword,
        body.newPassword
      );
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al cambiar contraseña',
        HttpStatus.BAD_REQUEST
      );
    }
  }
}