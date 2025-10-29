import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {} 

  async create(createUserDto: CreateUserDto) {
    try {
      console.log('Creando usuario:', createUserDto.correo);
      
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

      // Si el usuario existe pero solo tiene correo, actualizarlo
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