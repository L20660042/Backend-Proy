import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ======================================================
  // Crear usuario (método completo para ExcelService)
  // ======================================================
  async create(dto: CreateUserDto | any): Promise<UserDocument> {
    const exists = await this.userModel.findOne({ 
      email: dto.email.toLowerCase() 
    });
    
    if (exists) {
      throw new BadRequestException(`El email ${dto.email} ya está registrado`);
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = new this.userModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashed,
      active: dto.active !== undefined ? dto.active : true,
    });

    return user.save();
  }

  // ======================================================
  // Crear usuario simple (sin validaciones adicionales para Excel)
  // ======================================================
  async createSimple(userData: any): Promise<UserDocument> {
    // Hashear contraseña si no viene hasheada
    if (userData.password && !userData.password.startsWith('$2a$')) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }

    const user = new this.userModel({
      ...userData,
      email: userData.email.toLowerCase(),
    });

    return user.save();
  }

  // ======================================================
  // Obtener todos con filtros + RLS
  // ======================================================
  async findAll(currentUser?: any): Promise<UserDocument[]> {
    const filter: any = {};

    if (currentUser && currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'ADMIN') {
      if (currentUser.career) filter.career = currentUser.career;
    }

    return this.userModel
      .find(filter)
      .populate('career subjects groups')
      .sort({ createdAt: -1 })
      .exec();
  }

  // ======================================================
  // Obtener todos (método simple para ExcelService)
  // ======================================================
  async findAllSimple(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  // ======================================================
  // Búsqueda por ID
  // ======================================================
  async findOne(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findById(id)
      .populate('career subjects groups')
      .exec();

    if (!user) throw new NotFoundException('Usuario no encontrado');

    return user;
  }

  async findOneSimple(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  // ======================================================
  // Búsqueda por Email (ExcelService, Auth)
  // ======================================================
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ 
      email: email.toLowerCase() 
    }).exec();
  }

  // ======================================================
  // Actualizar usuario
  // ======================================================
  async update(id: string, dto: UpdateUserDto | any): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const updateData = { ...dto };

    // Si viene contraseña, encriptarla
    if (updateData.password && updateData.password.trim() !== '') {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password; // No actualizar contraseña
    }

    // Convertir email a minúsculas si se proporciona
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    Object.assign(user, updateData);
    return user.save();
  }

  async updateSimple(id: string, updateData: any): Promise<UserDocument | null> {
    return this.userModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true }
    ).exec();
  }

  // ======================================================
  // Activar/desactivar usuario
  // ======================================================
  async toggleActive(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    user.active = !user.active;
    return user.save();
  }

  // ======================================================
  // Eliminar usuario
  // ======================================================
  async delete(id: string): Promise<UserDocument | null> {
    return this.userModel.findByIdAndDelete(id);
  }

  // ======================================================
  // Buscar por email (para ExcelService)
  // ======================================================
  async findUserByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ 
      email: email.toLowerCase() 
    }).exec();
  }

  // ======================================================
  // Verificar si email existe
  // ======================================================
  async emailExists(email: string): Promise<boolean> {
    const count = await this.userModel.countDocuments({ 
      email: email.toLowerCase() 
    });
    return count > 0;
  }
}