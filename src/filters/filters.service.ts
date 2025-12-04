import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { FilterDto } from './dto/filter.dto';

@Injectable()
export class FiltersService {
  /** Convierte FilterDto en objeto para query de Mongoose */
  buildFilter(dto: FilterDto): any {
    const filter: any = {};

    if (dto.userId) filter.user = new Types.ObjectId(dto.userId);
    if (dto.studentId) filter.student = new Types.ObjectId(dto.studentId);
    if (dto.groupId) filter.group = new Types.ObjectId(dto.groupId);
    if (dto.subjectId) filter.subject = new Types.ObjectId(dto.subjectId);
    if (dto.careerId) filter.career = new Types.ObjectId(dto.careerId);

    if (dto.status) filter.status = dto.status;

    if (dto.startDate || dto.endDate) filter.createdAt = {};
    if (dto.startDate) filter.createdAt.$gte = new Date(dto.startDate);
    if (dto.endDate) filter.createdAt.$lte = new Date(dto.endDate);

    if (dto.type) filter.type = dto.type;

    return filter;
  }
}
