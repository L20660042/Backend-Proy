import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './user.schema';
import { RegisterUserDto } from './dto/register-user.dto';
import * as bcrypt from 'bcryptjs'; // ✅ CORREGIDO

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async register(dto: RegisterUserDto) {
    // Verificar si el usuario ya existe
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) {
      throw new ConflictException('El correo ya está registrado');
    }

    // Hashear la contraseña
    const hash = await bcrypt.hash(dto.password, 12);
    
    // Crear el usuario
    const user = await this.userModel.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      password: hash,
      userType: dto.userType,
    });

    return { 
      ok: true, 
      userId: user._id,
      message: 'Usuario registrado exitosamente'
    };
  }
}