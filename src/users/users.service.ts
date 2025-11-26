import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './user.schema';
import { CreateUserDto } from './DTO/create-user.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class UsersService {
  private readonly rolePermissions = {
    'administrador-general': [
      'system:config',
      'system:control',
      'users:manage',
      'institutions:manage',
      'departments:manage',
      'groups:manage',
      'teachers:manage',
      'tutors:manage',
      'academic:supervision',
      'reports:view'
    ],
    'jefe-departamento': [
      'groups:manage',
      'teachers:manage',
      'academic:supervision',
      'reports:view'
    ],
    'docente': [
      'teaching:execute',
      'evaluation:execute',
      'grades:manage',
      'attendance:record'
    ],
    'tutor': [
      'students:follow',
      'personalized:tracking',
      'reports:generate'
    ],
    'coordinador-tutorias': [
      'tutoring:program:manage',
      'tutors:coordinate',
      'reports:view'
    ],
    'control-escolar': [
      'academic:integrity',
      'records:manage',
      'certifications:issue'
    ],
    'subdireccion-academica': [
      'academic:supervision',
      'strategic:planning',
      'reports:view',
      'institutions:oversee'
    ]
  };

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  private getPermissionsForRole(role: string): string[] {
    return this.rolePermissions[role] || [];
  }

  // Método para crear un nuevo usuario
  async create(createUserDto: CreateUserDto): Promise<User> {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    // Obtener permisos basados en el tipo de usuario
    const permissions = this.getPermissionsForRole(createUserDto.userType);

    const createdUser = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
      permissions,
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
      userType: user.userType,
      permissions: user.permissions
    });

    console.log('Login exitoso, token generado');
    return { user, token };
  }
  
  async getProfile(userId: string): Promise<User> {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user;
  }

  async updateProfile(userId: string, updateData: any): Promise<User> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { 
        $set: {
          firstName: updateData.firstName,
          lastName: updateData.lastName,
          email: updateData.email
        }
      },
      { new: true }
    ).select('-password');
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    return user;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.userModel.findById(userId);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar contraseña actual
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new Error('Contraseña actual incorrecta');
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Actualizar contraseña
    user.password = hashedPassword;
    await user.save();

    return { message: 'Contraseña actualizada correctamente' };
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userModel.findById(userId).select('permissions');
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    return user.permissions || [];
  }
}