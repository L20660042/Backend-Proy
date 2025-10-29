import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  async create(createUserDto: CreateUserDto) {
    try {
      console.log('Creando usuario:', createUserDto.correo);
      
      // Verificar si el usuario ya existe de manera más robusta
      const existingUser = await this.userModel.findOne({ correo: createUserDto.correo });
      
      if (existingUser) {
        // Si el usuario existe y ya tiene datos completos
        if (existingUser.nombre && existingUser.apellido) {
          throw new BadRequestException('El usuario ya existe');
        }
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

      // Si el usuario existe pero está incompleto, actualizarlo
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
      
      // Manejar errores de duplicados de MongoDB
      if (error.code === 11000) {
        throw new BadRequestException('El correo electrónico ya está registrado');
      }
      
      // Si ya es una BadRequestException, relanzarla
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Para otros errores, lanzar InternalServerError
      throw new InternalServerErrorException('Error interno del servidor al crear el usuario');
    }
  }

  // Método adicional para encontrar usuario por email
  async findByEmail(correo: string): Promise<User | null> {
    try {
      return await this.userModel.findOne({ correo }).exec();
    } catch (error) {
      console.error('Error al buscar usuario por email:', error);
      throw new InternalServerErrorException('Error al buscar usuario');
    }
  }

  // Método para encontrar usuario por ID
  async findById(id: string): Promise<User | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch (error) {
      console.error('Error al buscar usuario por ID:', error);
      throw new InternalServerErrorException('Error al buscar usuario');
    }
  }

  // Método para verificar credenciales (útil para login)
  async validateUser(correo: string, password: string): Promise<User | null> {
    try {
      const user = await this.userModel.findOne({ correo }).exec();
      
      if (user && await bcrypt.compare(password, user.password)) {
        return user;
      }
      
      return null;
    } catch (error) {
      console.error('Error al validar usuario:', error);
      throw new InternalServerErrorException('Error al validar credenciales');
    }
  }

  // Método para obtener todos los usuarios (útil para administración)
  async findAll(): Promise<User[]> {
    try {
      return await this.userModel.find().exec();
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      throw new InternalServerErrorException('Error al obtener usuarios');
    }
  }
}