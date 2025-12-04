import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateUserDto } from './dto/create-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  // ======================================================
  // Crear usuario
  // ======================================================
  async create(dto: CreateUserDto): Promise<UserDocument> {
    const exists = await this.userModel.findOne({ email: dto.email.toLowerCase() });
    if (exists) throw new BadRequestException('El usuario ya existe');

    const hashed = await bcrypt.hash(dto.password, 10);

    const user = new this.userModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashed,
    });

    return user.save();
  }

  // ======================================================
  // Obtener todos con filtros + RLS
  // ======================================================
  async findAll(currentUser): Promise<UserDocument[]> {
    const filter: any = {};

    if (currentUser.role !== 'SUPERADMIN' && currentUser.role !== 'ADMIN') {
      if (currentUser.career) filter.career = currentUser.career;
    }

    return this.userModel
      .find(filter)
      .populate('career subjects groups')
      .sort({ createdAt: -1 })
      .exec();
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

  // ======================================================
  // Búsqueda por Email (ExcelService, Auth)
  // ======================================================
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  // ======================================================
  // Actualizar usuario
  // ======================================================
  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    Object.assign(user, dto);
    return user.save();
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
  // Eliminar usuario (soft delete si deseas)
  // ======================================================
  async delete(id: string) {
    return this.userModel.findByIdAndDelete(id);
  }
}
