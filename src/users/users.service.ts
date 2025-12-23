import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { TeachersService } from '../academic/teachers/teachers.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly teachersService: TeachersService,
  ) {}

  async findByEmail(email: string) {
    const q = this.userModel.findOne({ email: email.trim().toLowerCase() });
    return q.exec();
  }

  async list() {
    return this.userModel.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  }

  async create(dto: CreateUserDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const password = String((dto as any).password ?? '');

    if (!email) throw new BadRequestException('email requerido');
    if (!password) throw new BadRequestException('password requerido');

    const rolesRaw: any = (dto as any).roles;
    const rolesArr: string[] = Array.isArray(rolesRaw) ? rolesRaw : rolesRaw ? [rolesRaw] : [];
    if (rolesArr.length === 0) throw new BadRequestException('roles requerido');

    const rolesUpper = rolesArr.map((r) => String(r).toUpperCase());

    // linkedEntityId
    let linkedEntityId: string | null = null;
    const linkedRaw = (dto as any).linkedEntityId;

    if (linkedRaw === null || linkedRaw === undefined || linkedRaw === '') {
      linkedEntityId = null;
    } else {
      const s = String(linkedRaw);
      if (!Types.ObjectId.isValid(s)) throw new BadRequestException('linkedEntityId inválido');
      linkedEntityId = s;
    }

    // ====== AUTO-CREAR TEACHER SI ES DOCENTE Y NO VIENE linkedEntityId ======
    let createdTeacherId: string | null = null;

    if (!linkedEntityId && rolesUpper.includes('DOCENTE')) {
      const teacherName = String(dto.teacherName ?? email.split('@')[0] ?? '').trim();
      const employeeNumber = String(dto.employeeNumber ?? '').trim();

      if (!employeeNumber) {
        throw new BadRequestException('employeeNumber requerido para crear docente automáticamente');
      }
      if (!teacherName || teacherName.length < 3) {
        throw new BadRequestException('teacherName requerido (mínimo 3 caracteres) para crear docente automáticamente');
      }

      const teacher = await this.teachersService.create({
        name: teacherName,
        employeeNumber,
        status: 'active',
      } as any);

      createdTeacherId = String((teacher as any)._id);
      linkedEntityId = createdTeacherId;
    }

    try {
      const doc = await this.userModel.create({
        email,
        passwordHash: await bcrypt.hash(password, 10),
        roles: rolesUpper,
        status: (dto as any).status ?? 'active',
        linkedEntityId,
      });

      const user = doc.toObject() as any;
      delete user.passwordHash;
      return user;
    } catch (err: any) {
      // rollback teacher si el user falló (ej: email duplicado)
      if (createdTeacherId) {
        try {
          await this.teachersService.remove(createdTeacherId);
        } catch (_) {
          // ignorar
        }
      }

      if (err?.code === 11000) {
        if (err?.keyPattern?.email) throw new BadRequestException('El email ya existe');
        throw new BadRequestException('Campo único duplicado');
      }
      if (err?.name === 'ValidationError') throw new BadRequestException(err.message);
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const update: any = {};

    if (dto.roles) update.roles = dto.roles.map((r) => String(r).toUpperCase());
    if (dto.status) update.status = dto.status;

    if (dto.linkedEntityId === null) update.linkedEntityId = null;
    if (dto.linkedEntityId !== undefined && dto.linkedEntityId !== null) {
      if (!Types.ObjectId.isValid(dto.linkedEntityId)) throw new BadRequestException('linkedEntityId inválido');
      update.linkedEntityId = dto.linkedEntityId;
    }

    if (dto.password) {
      update.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const doc = await this.userModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select('-passwordHash')
      .lean();

    if (!doc) throw new NotFoundException('Usuario no encontrado');
    return doc;
  }
}
