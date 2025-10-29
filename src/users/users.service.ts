import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { MailService } from '../mailer/mailer.service';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private mailService: MailService,
  ) {}

  async sendVerificationCode(email: string) {
    try {
      console.log('Enviando código de verificación a:', email);
      
      let user = await this.userModel.findOne({ correo: email });
      if (!user) {
        user = new this.userModel({ correo: email });
      }

      const code = Math.floor(100000 + Math.random() * 900000).toString();
      user.verificationCode = code;
      user.verificationCodeExpires = new Date(Date.now() + 15 * 60000);
      await user.save();

      await this.mailService.sendVerificationCode(email, code);
      console.log('Código enviado exitosamente');
      return { message: 'Código enviado' };
    } catch (error) {
      console.error('Error en sendVerificationCode:', error);
      throw new BadRequestException('Error al enviar el correo');
    }
  }

  async validateVerificationCode(email: string, code: string) {
    try {
      console.log('Validando código para:', email);
      
      const user = await this.userModel.findOne({ correo: email });
      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      if (!user.verificationCode || user.verificationCode !== code) {
        throw new BadRequestException('Código inválido');
      }

      if (!user.verificationCodeExpires || user.verificationCodeExpires < new Date()) {
        throw new BadRequestException('Código expirado');
      }

      user.isVerified = true;
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      await user.save();

      console.log('Código validado exitosamente');
      return { message: 'Correo verificado correctamente' };
    } catch (error) {
      console.error('Error en validateVerificationCode:', error);
      throw error;
    }
  }

  async isEmailVerified(email: string): Promise<boolean> {
    try {
      const user = await this.userModel.findOne({ correo: email });
      return user?.isVerified || false;
    } catch (error) {
      console.error('Error en isEmailVerified:', error);
      return false;
    }
  }

  async create(createUserDto: CreateUserDto) {
    try {
      console.log('Creando usuario:', createUserDto.correo);
      
      // Verificar si el correo está verificado
      const verified = await this.isEmailVerified(createUserDto.correo);
      if (!verified) {
        throw new BadRequestException('El correo no está verificado');
      }

      // Verificar si el usuario ya existe
      const existingUser = await this.userModel.findOne({ correo: createUserDto.correo });
      if (existingUser && existingUser.nombre) {
        throw new BadRequestException('El usuario ya existe');
      }

      // Validar que las contraseñas coincidan
      if (createUserDto.password !== createUserDto.confirmPassword) {
        throw new BadRequestException('Las contraseñas no coinciden');
      }

      // Encriptar contraseña
      const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

      const userData = {
        nombre: createUserDto.nombre,
        apellido: createUserDto.apellido,
        correo: createUserDto.correo,
        password: hashedPassword,
        userType: createUserDto.userType,
        isVerified: true,
      };

      console.log('Datos del usuario a crear:', userData);

      // Si el usuario existe pero solo tiene correo (de la verificación), actualizarlo
      if (existingUser) {
        const updatedUser = await this.userModel.findOneAndUpdate(
          { correo: createUserDto.correo },
          userData,
          { new: true }
        );
        console.log('Usuario actualizado:', updatedUser);
        return updatedUser;
      }

      // Si no existe, crear nuevo usuario
      const createdUser = new this.userModel(userData);
      const savedUser = await createdUser.save();
      console.log('Usuario creado exitosamente:', savedUser);
      
      return savedUser;
    } catch (error) {
      console.error('Error en create user:', error);
      if (error.code === 11000) {
        throw new BadRequestException('El correo electrónico ya está registrado');
      }
      throw error;
    }
  }
}