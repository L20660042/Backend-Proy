import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';
import { TeachersService } from '../academic/teachers/teachers.service';
import { UpsertUserDto } from './dto/upsert-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly teachersService: TeachersService,
  ) {}

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  async list() {
    return this.userModel.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  }

  async create(dto: CreateUserDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const password = String((dto as any).password ?? '');

    if (!email) throw new BadRequestException('email requerido');
    if (!password) throw new BadRequestException('password requerido');

    // roles
    const rolesRaw: any = (dto as any).roles;
    const rolesArr: string[] = Array.isArray(rolesRaw) ? rolesRaw : rolesRaw ? [rolesRaw] : [];
    if (rolesArr.length === 0) throw new BadRequestException('roles requerido');

    const rolesUpper = rolesArr.map((r) => String(r).toUpperCase());

    // linkedEntityId (string en tu schema)
    let linkedEntityId: string | null = null;
    const linkedRaw = (dto as any).linkedEntityId;

    if (linkedRaw === null || linkedRaw === undefined || linkedRaw === '') {
      linkedEntityId = null;
    } else {
      const s = String(linkedRaw);
      if (!Types.ObjectId.isValid(s)) throw new BadRequestException('linkedEntityId inválido');
      linkedEntityId = s;
    }

    // ===== AUTO-CREAR TEACHER SI ES DOCENTE Y NO VIENE linkedEntityId =====
    let createdTeacherId: string | null = null;

    if (!linkedEntityId && rolesUpper.includes('DOCENTE')) {
      const teacherName = String((dto as any).teacherName ?? email.split('@')[0] ?? '').trim();
      const employeeNumber = String((dto as any).employeeNumber ?? '').trim();

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
        // OJO: tu schema usa active/inactive/pending.
        // Asegúrate de que tu CreateUserDto también esté alineado.
        status: (dto as any).status ?? 'active',
        linkedEntityId,
      });

      const user = doc.toObject() as any;
      delete user.passwordHash;
      return user;
    } catch (err: any) {
      // rollback teacher si falló crear user
      if (createdTeacherId) {
        try {
          await this.teachersService.remove(createdTeacherId);
        } catch {
          // ignore
        }
      }

      // Email duplicado (índice unique)
      if (err?.code === 11000) {
        if (err?.keyPattern?.email) throw new BadRequestException('El email ya existe');
        throw new BadRequestException('Campo único duplicado');
      }

      // Validación Mongoose
      if (err?.name === 'ValidationError') {
        throw new BadRequestException(err.message);
      }

      throw err;
    }
  }
 async upsert(dto: UpsertUserDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    if (!email) throw new BadRequestException('email requerido');

    const linkedRaw = (dto as any).linkedEntityId;
    const linkedEntityId =
      linkedRaw === '' ? null : linkedRaw === undefined ? undefined : linkedRaw;

    const existing = await this.userModel.findOne({ email }).exec();
    if (existing) {
      const patch: UpdateUserDto = {} as any;

      if (dto.roles !== undefined) patch.roles = dto.roles;
      if (dto.status !== undefined) patch.status = dto.status;
      if (linkedEntityId !== undefined) patch.linkedEntityId = linkedEntityId as any;
      if (dto.password) (patch as any).password = dto.password;

      return this.update(String((existing as any)._id), patch);
    }
    const rolesRaw: any = (dto as any).roles;
    const rolesArr: string[] = Array.isArray(rolesRaw) ? rolesRaw : rolesRaw ? [rolesRaw] : [];
    if (rolesArr.length === 0) throw new BadRequestException('roles requerido');

    const password = String(dto.password ?? '').trim();
    if (!password) throw new BadRequestException('password requerido');

    return this.create({
      email,
      password,
      roles: rolesArr,
      status: dto.status ?? 'active',
      linkedEntityId: linkedEntityId === undefined ? null : (linkedEntityId as any),
      teacherName: (dto as any).teacherName,
      employeeNumber: (dto as any).employeeNumber,
    } as any);
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

    if ((dto as any).password) {
      update.passwordHash = await bcrypt.hash(String((dto as any).password), 10);
    }

    const doc = await this.userModel
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .select('-passwordHash')
      .lean();

    if (!doc) throw new NotFoundException('Usuario no encontrado');
    return doc;
  }
}
