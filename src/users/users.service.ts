import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt'; // Importar JwtService
import { User } from './user.schema';
import { CreateUserDto } from './DTO/create-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService, // Inyectar JwtService
  ) {}

  // Método para crear un nuevo usuario
  async create(createUserDto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });

    return createdUser.save();
  }

  // Método para validar las credenciales y generar un JWT 
  async validateUserPassword(email: string, password: string): Promise<{ user: User; token: string }> {
    console.log('Buscando usuario con email:', email);
    const user = await this.userModel.findOne({ email });
    
    if (!user) {
      console.log('Usuario no encontrado');
      throw new Error('Usuario no encontrado');
    }

    console.log('Usuario encontrado, verificando contraseña');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Contraseña incorrecta');
      throw new Error('Contraseña incorrecta');
    }

    // Generar el token JWT
    const token = this.jwtService.sign({ 
      userId: (user._id as Types.ObjectId).toString(), 
      userType: user.userType 
    });

    console.log('Login exitoso, token generado');
    return { user, token };
  }
  
  async getProfile(userId: string): Promise<User> {
    return this.userModel.findById(userId).select('-password');  // Excluir la contraseña
  }
}