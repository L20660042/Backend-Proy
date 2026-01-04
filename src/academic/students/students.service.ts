import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Student } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UsersService } from '../../users/users.service';
import { Role } from '../../auth/roles.enum';

@Injectable()
export class StudentsService {
  
  private readonly STUDENT_EMAIL_DOMAIN = 'matehuala.tecnm.mx';

  constructor(
    @InjectModel(Student.name) private model: Model<Student>,
    private readonly users: UsersService,
  ) {}

  private studentEmailFromControlNumber(controlNumber: string) {
    const cn = String(controlNumber ?? '').trim();
    return `l${cn}@${this.STUDENT_EMAIL_DOMAIN}`.toLowerCase();
  }

  private async syncPendingUserForStudent(controlNumber: string, studentId: string) {
    const email = this.studentEmailFromControlNumber(controlNumber);
    const user = await this.users.findByEmail(email);

    if (!user) return;

    const currentStatus = String((user as any).status ?? '');
    const currentLinked = String((user as any).linkedEntityId ?? '');

    const rolesRaw = Array.isArray((user as any).roles) ? (user as any).roles : [];
    const rolesUpper = rolesRaw.map((r: any) => String(r).toUpperCase());
    const hasAlumno = rolesUpper.includes(Role.ALUMNO);

    const needsUpdate =
      currentStatus !== 'active' ||
      currentLinked !== String(studentId) ||
      !hasAlumno;

    if (!needsUpdate) return;

    const nextRoles = hasAlumno ? rolesUpper : [...rolesUpper, Role.ALUMNO];

    await this.users.update(String((user as any)._id), {
      status: 'active',
      linkedEntityId: String(studentId),
      roles: nextRoles,
    } as any);
  }

  async create(dto: CreateStudentDto) {
    const controlNumber = dto.controlNumber.trim();
    const name = dto.name.trim();

    try {
      const created = await this.model.create({
        controlNumber,
        name,
        careerId: new Types.ObjectId(dto.careerId),
        groupId: dto.groupId ? new Types.ObjectId(dto.groupId) : null,
        status: dto.status ?? 'active',
      });

      await this.syncPendingUserForStudent(controlNumber, String((created as any)._id));

      return created;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El controlNumber del alumno ya existe');
      }
      throw err;
    }
  }

  findAll(params?: { careerId?: string; groupId?: string; status?: string }) {
    const filter: any = {};
    if (params?.careerId) filter.careerId = new Types.ObjectId(params.careerId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.status) filter.status = params.status;

    return this.model.find(filter).sort({ name: 1 }).exec();
  }

  async findOne(id: string) {
    const doc = await this.model.findById(id).exec();
    if (!doc) throw new NotFoundException('Alumno no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const update: any = {};
    if (dto.controlNumber !== undefined) update.controlNumber = dto.controlNumber.trim();
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.careerId !== undefined) update.careerId = new Types.ObjectId(dto.careerId);
    if (dto.groupId !== undefined) update.groupId = dto.groupId ? new Types.ObjectId(dto.groupId) : null;
    if (dto.status !== undefined) update.status = dto.status;

    try {
      const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
      if (!updated) throw new NotFoundException('Alumno no encontrado');

     
      await this.syncPendingUserForStudent(
        String((updated as any).controlNumber),
        String((updated as any)._id),
      );

      return updated;
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new BadRequestException('El controlNumber del alumno ya existe');
      }
      throw err;
    }
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Alumno no encontrado');
    return { deleted: true };
  }

  async findByControlNumber(controlNumber: string) {
    return this.model.findOne({ controlNumber: controlNumber.trim() }).exec();
  }
}
