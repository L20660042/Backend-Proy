import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';
import { Enrollment, EnrollmentDocument } from './schemas/enrollment.schema';
import { CourseEnrollmentsService } from '../course-enrollments/course-enrollments.service';

function oid(x: any) {
  return String((x as any)?._id ?? x ?? '');
}

@Injectable()
export class EnrollmentsService {
  constructor(
    @InjectModel(Enrollment.name) private readonly model: Model<EnrollmentDocument>,
    @Inject(forwardRef(() => CourseEnrollmentsService))
    private readonly courseEnrollments: CourseEnrollmentsService,
  ) {}

  async list(params?: { periodId?: string; groupId?: string; studentId?: string; status?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.studentId) filter.studentId = new Types.ObjectId(params.studentId);
    if (params?.status) filter.status = params.status;

    return this.model
      .find(filter)
      .populate('studentId')
      .populate('groupId')
      .populate('periodId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async create(dto: CreateEnrollmentDto) {
    const periodId = dto.periodId;
    const studentId = dto.studentId;
    const groupId = dto.groupId;
    const status = dto.status ?? 'active';

    if (!Types.ObjectId.isValid(periodId)) throw new BadRequestException('periodId inválido');
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('studentId inválido');
    if (!Types.ObjectId.isValid(groupId)) throw new BadRequestException('groupId inválido');

    // antes (para detectar cambio de grupo)
    const before = await this.model
      .findOne({ periodId: new Types.ObjectId(periodId), studentId: new Types.ObjectId(studentId) })
      .lean();

    // upsert
    const doc = await this.model
      .findOneAndUpdate(
        { periodId: new Types.ObjectId(periodId), studentId: new Types.ObjectId(studentId) },
        {
          $set: {
            groupId: new Types.ObjectId(groupId),
            status,
          },
          $setOnInsert: {
            periodId: new Types.ObjectId(periodId),
            studentId: new Types.ObjectId(studentId),
          },
        },
        { new: true, upsert: true, runValidators: true },
      )
      .populate('studentId')
      .populate('groupId')
      .populate('periodId')
      .lean();

    // Auto-sync
    if (status !== 'active') {
      await this.courseEnrollments.deactivateByStudentAndPeriod({ periodId, studentId });
      return doc;
    }

    // si cambió de grupo, desactivar lo del grupo anterior
    const oldGroupId = before ? oid(before.groupId) : '';
    if (oldGroupId && oldGroupId !== String(groupId)) {
      await this.courseEnrollments.deactivateByStudentAndGroup({
        periodId,
        studentId,
        groupId: oldGroupId,
      });
    }

    await this.courseEnrollments.syncStudentToGroupLoads({ periodId, studentId, groupId, status: 'active' });

    return doc;
  }

  async update(id: string, dto: UpdateEnrollmentDto) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const before = await this.model.findById(id).lean();
    if (!before) throw new NotFoundException('Inscripción no encontrada');

    const update: any = {};
    if (dto.groupId) {
      if (!Types.ObjectId.isValid(dto.groupId)) throw new BadRequestException('groupId inválido');
      update.groupId = new Types.ObjectId(dto.groupId);
    }
    if (dto.status) update.status = dto.status;

    const doc = await this.model
      .findByIdAndUpdate(id, update, { new: true, runValidators: true })
      .populate('studentId')
      .populate('groupId')
      .populate('periodId')
      .lean();

    if (!doc) throw new NotFoundException('Inscripción no encontrada');

    const periodId = oid(doc.periodId);
    const studentId = oid(doc.studentId);
    const newGroupId = oid(doc.groupId);

    const oldGroupId = oid(before.groupId);
    const oldStatus = (before as any).status;
    const newStatus = (doc as any).status;

    // si se dio de baja, desactivar todo el periodo
    if (newStatus !== 'active') {
      await this.courseEnrollments.deactivateByStudentAndPeriod({ periodId, studentId });
      return doc;
    }

    // si reactivó o cambió de grupo: sincronizar
    const groupChanged = oldGroupId && newGroupId && oldGroupId !== newGroupId;
    const reactivated = oldStatus !== 'active' && newStatus === 'active';

    if (groupChanged) {
      await this.courseEnrollments.deactivateByStudentAndGroup({ periodId, studentId, groupId: oldGroupId });
      await this.courseEnrollments.syncStudentToGroupLoads({ periodId, studentId, groupId: newGroupId, status: 'active' });
    } else if (reactivated) {
      await this.courseEnrollments.syncStudentToGroupLoads({ periodId, studentId, groupId: newGroupId, status: 'active' });
    }

    return doc;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');

    const before = await this.model.findById(id).lean();
    if (!before) throw new NotFoundException('Inscripción no encontrada');

    const periodId = oid(before.periodId);
    const studentId = oid(before.studentId);

    // coherencia: si borras enrollment, desactiva sus materias del periodo
    await this.courseEnrollments.deactivateByStudentAndPeriod({ periodId, studentId });

    await this.model.findByIdAndDelete(id).lean();
    return { ok: true };
  }

  async findActiveByStudentAndPeriod(periodId: string, studentId: string) {
    if (!Types.ObjectId.isValid(periodId) || !Types.ObjectId.isValid(studentId)) return null;

    return this.model
      .findOne({
        periodId: new Types.ObjectId(periodId),
        studentId: new Types.ObjectId(studentId),
        status: 'active',
      })
      .lean();
  }
}
