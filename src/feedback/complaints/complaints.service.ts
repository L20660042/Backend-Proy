import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TeacherComplaint, TeacherComplaintDocument } from './schemas/teacher-complaint.schema';
import { CreateTeacherComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

import { AiClientService } from '../ai/ai.client';
import { ClassAssignment, ClassAssignmentDocument } from '../../academic/class-assignments/schemas/class-assignment.schema';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(TeacherComplaint.name) private readonly model: Model<TeacherComplaintDocument>,
    @InjectModel(ClassAssignment.name) private readonly caModel: Model<ClassAssignmentDocument>,
    private readonly ai: AiClientService,
  ) {}

  async createAsStudent(user: any, dto: CreateTeacherComplaintDto) {
    const roles: string[] = user?.roles ?? [];
    const studentId = user?.linkedEntityId;

    if (!roles.includes('ALUMNO')) throw new ForbiddenException('Solo ALUMNO');
    if (!studentId) throw new ForbiddenException('Usuario sin linkedEntityId (alumno)');
    if (!dto.periodId) throw new BadRequestException('periodId requerido');

    // Si manda classAssignmentId, denormaliza teacher/group/subject
    let teacherId: string | null = dto.teacherId ?? null;
    let classAssignmentId: string | null = dto.classAssignmentId ?? null;
    let groupId: string | null = null;
    let subjectId: string | null = null;

    if (classAssignmentId) {
      const ca = await this.caModel.findById(classAssignmentId).lean();
      if (!ca) throw new BadRequestException('ClassAssignment no existe');
      const caPeriod = String((ca as any).periodId);
      if (caPeriod !== String(dto.periodId)) throw new BadRequestException('La carga no pertenece al periodo indicado');

      teacherId = String((ca as any).teacherId);
      groupId = String((ca as any).groupId);
      subjectId = String((ca as any).subjectId);
    }

    if (!teacherId) {
      // Permitimos queja general, pero al menos debe existir categoría/desc
      teacherId = null;
    }

    const created = await this.model.create({
      periodId: dto.periodId,
      studentId: String(studentId),
      teacherId,
      classAssignmentId,
      groupId,
      subjectId,
      category: dto.category,
      description: String(dto.description ?? '').trim(),
      status: 'open',
      resolutionNote: '',
      analysis: null,
    });

    // IA
    const text = String(dto.description ?? '').trim();
    if (text) {
      const analysis = await this.ai.analyzeText({ text, lang: 'es', tasks: ['sentiment', 'topics', 'summary'] });
      if (analysis) {
        await this.model.updateOne({ _id: created._id }, { $set: { analysis } });
      }
    }

    return { message: 'Queja registrada', id: String(created._id) };
  }

  async listMyComplaints(user: any, periodId: string) {
    const roles: string[] = user?.roles ?? [];
    const studentId = user?.linkedEntityId;

    if (!roles.includes('ALUMNO')) throw new ForbiddenException('Solo ALUMNO');
    if (!studentId) throw new ForbiddenException('Usuario sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    return this.model
      .find({ periodId, studentId: String(studentId) })
      .populate('teacherId')
      .populate('subjectId')
      .populate('groupId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async teacherSummary(user: any, periodId: string) {
    const roles: string[] = user?.roles ?? [];
    const teacherId = user?.linkedEntityId;

    if (!roles.includes('DOCENTE')) throw new ForbiddenException('Solo DOCENTE');
    if (!teacherId) throw new ForbiddenException('Usuario sin linkedEntityId');
    if (!periodId) throw new BadRequestException('periodId requerido');

    const docs = await this.model.find({ periodId, teacherId: String(teacherId) }).select({ category: 1, status: 1, analysis: 1 }).lean();

    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const topicCounts: Record<string, number> = {};

    for (const d of docs) {
      byStatus[(d as any).status] = (byStatus[(d as any).status] ?? 0) + 1;
      byCategory[(d as any).category] = (byCategory[(d as any).category] ?? 0) + 1;

      const topics = (d as any).analysis?.topics;
      if (Array.isArray(topics)) {
        for (const t of topics) {
          const label = String(t?.label ?? '').trim();
          if (!label) continue;
          topicCounts[label] = (topicCounts[label] ?? 0) + 1;
        }
      }
    }

    const topTopics = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    return {
      periodId,
      teacherId: String(teacherId),
      totalComplaints: docs.length,
      byStatus,
      byCategory,
      topTopics,
    };
  }

  async adminList(periodId?: string, status?: string) {
    const q: any = {};
    if (periodId) q.periodId = periodId;
    if (status) q.status = status;

    return this.model
      .find(q)
      .populate('teacherId')
      .populate('studentId')
      .populate('subjectId')
      .populate('groupId')
      .sort({ createdAt: -1 })
      .lean();
  }

  async adminUpdateStatus(id: string, dto: UpdateComplaintStatusDto, user: any) {
    if (!id) throw new BadRequestException('id requerido');

    await this.model.updateOne(
      { _id: id },
      {
        $set: {
          status: dto.status,
          resolutionNote: String(dto.resolutionNote ?? '').trim(),
          assignedToUserId: user?.sub ? String(user.sub) : null,
        },
      },
    );

    return { message: 'Estatus actualizado' };
  }
}
