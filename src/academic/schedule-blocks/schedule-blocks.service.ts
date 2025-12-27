import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ScheduleBlock, ScheduleBlockDocument } from './schemas/schedule-block.schema';
import { CreateScheduleBlockDto } from './dto/create-schedule-block.dto';
import { UpdateScheduleBlockDto } from './dto/update-schedule-block.dto';

type DeliveryMode = 'presencial' | 'semipresencial' | 'asincrono';

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// Traslape: [aStart, aEnd) vs [bStart, bEnd) -> se traslapan si aStart < bEnd && bStart < aEnd
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function normalizeDeliveryMode(raw: any): DeliveryMode {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');

  if (!s) return 'presencial';

  // tolerancias comunes
  if (s === 'presencial') return 'presencial';
  if (s === 'semipresencial' || s === 'semi-presencial' || s === 'semipresencial') return 'semipresencial';
  if (s === 'asincrono' || s === 'asíncrono') return 'asincrono';

  // fallback seguro
  return 'presencial';
}

@Injectable()
export class ScheduleBlocksService {
  constructor(
    @InjectModel(ScheduleBlock.name)
    private readonly model: Model<ScheduleBlockDocument>,
  ) {}

  private validateBusinessRules(dto: CreateScheduleBlockDto | UpdateScheduleBlockDto | any) {
    if (dto.startTime && dto.endTime) {
      const s = toMinutes(dto.startTime);
      const e = toMinutes(dto.endTime);
      if (e <= s) throw new BadRequestException('endTime debe ser mayor que startTime');
    }

    if ((dto as any).type === 'class') {
      // Para clases exigimos groupId, subjectId, teacherId
      if (!('groupId' in dto) || !(dto as any).groupId) throw new BadRequestException('groupId es requerido para type=class');
      if (!('subjectId' in dto) || !(dto as any).subjectId) throw new BadRequestException('subjectId es requerido para type=class');
      if (!('teacherId' in dto) || !(dto as any).teacherId) throw new BadRequestException('teacherId es requerido para type=class');
    }
  }

  /**
   * REGLA NUEVA (según tu negocio):
   * - Un grupo NO puede tener 2 clases a la misma hora SI ambas son PRESENCIALES.
   * - Si alguna es SEMIPRESENCIAL o ASINCRONO, el traslape por grupo se permite.
   * - Docente y aula: se bloquean traslapes siempre que ninguno de los dos sea ASINCRONO.
   */
  private async assertNoConflicts(params: {
    periodId: Types.ObjectId;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string | null;
    groupId?: Types.ObjectId | null;
    teacherId?: Types.ObjectId | null;
    deliveryMode: DeliveryMode;
    excludeId?: string;
  }) {
    const s = toMinutes(params.startTime);
    const e = toMinutes(params.endTime);

    const newMode = params.deliveryMode ?? 'presencial';
    const newIsAsync = newMode === 'asincrono';
    const newIsPresencial = newMode === 'presencial';

    // armamos filtro por dimensiones relevantes
    const or: any[] = [];

    // aula: solo si el bloque nuevo NO es asincrono y trae room
    if (!newIsAsync && params.room) or.push({ room: params.room });

    // docente: solo si el bloque nuevo NO es asincrono y trae teacherId
    if (!newIsAsync && params.teacherId) or.push({ teacherId: params.teacherId });

    // grupo: solo consultamos si el nuevo es presencial (es el único caso donde podría bloquearse por grupo)
    if (newIsPresencial && params.groupId) or.push({ groupId: params.groupId });

    if (or.length === 0) return;

    const filter: any = {
      periodId: params.periodId,
      dayOfWeek: params.dayOfWeek,
      $or: or,
    };

    if (params.excludeId) filter._id = { $ne: new Types.ObjectId(params.excludeId) };

    const candidates = await this.model.find(filter).exec();

    for (const c of candidates) {
      const cs = toMinutes(c.startTime);
      const ce = toMinutes(c.endTime);

      if (!overlaps(s, e, cs, ce)) continue;

      const existingMode = normalizeDeliveryMode((c as any).deliveryMode);
      const existingIsAsync = existingMode === 'asincrono';
      const existingIsPresencial = existingMode === 'presencial';

      // 1) Docente: conflicto si ambos NO son asincrono
      if (
        params.teacherId &&
        c.teacherId &&
        String(params.teacherId) === String(c.teacherId) &&
        !newIsAsync &&
        !existingIsAsync
      ) {
        throw new BadRequestException(`Choque de docente con bloque existente (${c.startTime}-${c.endTime})`);
      }

      // 2) Grupo: conflicto SOLO si ambos son presenciales
      if (
        params.groupId &&
        c.groupId &&
        String(params.groupId) === String(c.groupId) &&
        newIsPresencial &&
        existingIsPresencial
      ) {
        throw new BadRequestException(`Choque de grupo con bloque existente (${c.startTime}-${c.endTime})`);
      }

      // 3) Aula: conflicto si ambos NO son asincrono
      if (
        params.room &&
        c.room &&
        params.room === c.room &&
        !newIsAsync &&
        !existingIsAsync
      ) {
        throw new BadRequestException(`Choque de aula con bloque existente (${c.startTime}-${c.endTime})`);
      }
    }
  }

  async create(dto: CreateScheduleBlockDto & { deliveryMode?: DeliveryMode }) {
    const deliveryMode: DeliveryMode = normalizeDeliveryMode((dto as any).deliveryMode);

    this.validateBusinessRules({ ...dto, deliveryMode });

    const periodId = new Types.ObjectId(dto.periodId);
    const groupId = dto.groupId ? new Types.ObjectId(dto.groupId) : null;
    const teacherId = dto.teacherId ? new Types.ObjectId(dto.teacherId) : null;

    await this.assertNoConflicts({
      periodId,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      room: dto.room?.trim() ?? null,
      groupId,
      teacherId,
      deliveryMode,
    });

    return this.model.create({
      periodId,
      type: dto.type,
      // ⚠️ requiere que exista en schema para persistir (si no, Mongoose lo ignora)
      deliveryMode,
      dayOfWeek: dto.dayOfWeek,
      startTime: dto.startTime,
      endTime: dto.endTime,
      room: dto.room?.trim() ?? null,
      groupId,
      subjectId: dto.subjectId ? new Types.ObjectId(dto.subjectId) : null,
      teacherId,
      activityId: dto.activityId ? new Types.ObjectId(dto.activityId) : null,
    } as any);
  }

  findAll(params?: { periodId?: string; groupId?: string; teacherId?: string; dayOfWeek?: string }) {
    const filter: any = {};
    if (params?.periodId) filter.periodId = new Types.ObjectId(params.periodId);
    if (params?.groupId) filter.groupId = new Types.ObjectId(params.groupId);
    if (params?.teacherId) filter.teacherId = new Types.ObjectId(params.teacherId);
    if (params?.dayOfWeek) filter.dayOfWeek = Number(params.dayOfWeek);

    return this.model
      .find(filter)
      .populate('periodId', 'name')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name employeeNumber')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .exec();
  }

  findByClassTriples(params: {
    periodId: string;
    triples: Array<{ groupId: string; subjectId: string; teacherId: string }>;
  }) {
    const pid = new Types.ObjectId(params.periodId);

    if (!params.triples || params.triples.length === 0) {
      return Promise.resolve([]);
    }

    const or = params.triples.map((t) => ({
      groupId: new Types.ObjectId(t.groupId),
      subjectId: new Types.ObjectId(t.subjectId),
      teacherId: new Types.ObjectId(t.teacherId),
    }));

    return this.model
      .find({
        periodId: pid,
        type: 'class',
        $or: or,
      })
      .populate('periodId', 'name')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name employeeNumber')
      .sort({ dayOfWeek: 1, startTime: 1 })
      .exec();
  }

  async findOne(id: string) {
    const doc = await this.model
      .findById(id)
      .populate('periodId', 'name')
      .populate('groupId', 'name semester')
      .populate('subjectId', 'name code')
      .populate('teacherId', 'name employeeNumber')
      .exec();

    if (!doc) throw new NotFoundException('Bloque de horario no encontrado');
    return doc;
  }

  async update(id: string, dto: UpdateScheduleBlockDto & { deliveryMode?: DeliveryMode }) {
    const current = await this.model.findById(id).exec();
    if (!current) throw new NotFoundException('Bloque de horario no encontrado');

    const merged: any = {
      periodId: dto.periodId ?? String(current.periodId),
      type: dto.type ?? current.type,
      dayOfWeek: dto.dayOfWeek ?? current.dayOfWeek,
      startTime: dto.startTime ?? current.startTime,
      endTime: dto.endTime ?? current.endTime,
      room: dto.room ?? current.room,
      groupId: dto.groupId ?? (current.groupId ? String(current.groupId) : undefined),
      subjectId: dto.subjectId ?? (current.subjectId ? String(current.subjectId) : undefined),
      teacherId: dto.teacherId ?? (current.teacherId ? String(current.teacherId) : undefined),

      // deliveryMode: dto si viene, si no, el del doc, si no existe, 'presencial'
      deliveryMode: normalizeDeliveryMode((dto as any).deliveryMode ?? (current as any).deliveryMode ?? 'presencial'),
    };

    this.validateBusinessRules(merged);

    const periodId = new Types.ObjectId(merged.periodId);
    const groupId = merged.groupId ? new Types.ObjectId(merged.groupId) : null;
    const teacherId = merged.teacherId ? new Types.ObjectId(merged.teacherId) : null;

    await this.assertNoConflicts({
      periodId,
      dayOfWeek: merged.dayOfWeek,
      startTime: merged.startTime,
      endTime: merged.endTime,
      room: (merged.room ?? null)?.trim?.() ?? merged.room ?? null,
      groupId,
      teacherId,
      deliveryMode: merged.deliveryMode as DeliveryMode,
      excludeId: id,
    });

    const update: any = {};
    if (dto.periodId !== undefined) update.periodId = new Types.ObjectId(dto.periodId);
    if (dto.type !== undefined) update.type = dto.type;
    if (dto.dayOfWeek !== undefined) update.dayOfWeek = dto.dayOfWeek;
    if (dto.startTime !== undefined) update.startTime = dto.startTime;
    if (dto.endTime !== undefined) update.endTime = dto.endTime;
    if (dto.room !== undefined) update.room = dto.room?.trim() ?? null;
    if (dto.groupId !== undefined) update.groupId = dto.groupId ? new Types.ObjectId(dto.groupId) : null;
    if (dto.subjectId !== undefined) update.subjectId = dto.subjectId ? new Types.ObjectId(dto.subjectId) : null;
    if (dto.teacherId !== undefined) update.teacherId = dto.teacherId ? new Types.ObjectId(dto.teacherId) : null;
    if (dto.activityId !== undefined) update.activityId = dto.activityId ? new Types.ObjectId(dto.activityId) : null;

    // ⚠️ requiere schema para persistir
    if ((dto as any).deliveryMode !== undefined) update.deliveryMode = normalizeDeliveryMode((dto as any).deliveryMode);

    const updated = await this.model.findByIdAndUpdate(id, update, { new: true }).exec();
    return updated;
  }

  async remove(id: string) {
    const deleted = await this.model.findByIdAndDelete(id).exec();
    if (!deleted) throw new NotFoundException('Bloque de horario no encontrado');
    return { deleted: true };
  }
}
