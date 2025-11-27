import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Complaint } from './complaint.schema';
import { CreateComplaintDto } from './DTO/create-complaint.dto';
import { UpdateComplaintDto } from './DTO/update-complaint.dto';
import { FilterComplaintsDto } from './DTO/filter-complaints.dto';
import { User } from '../users/user.schema';

@Injectable()
export class ComplaintsService {
  constructor(
    @InjectModel(Complaint.name) private complaintModel: Model<Complaint>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createComplaint(createComplaintDto: CreateComplaintDto, studentId: string, institutionId: string): Promise<Complaint> {
    // Verificar que el estudiante existe y pertenece a la institución
    const student = await this.userModel.findOne({
      _id: studentId,
      institution: institutionId,
      userType: 'estudiante'
    });

    if (!student) {
      throw new ForbiddenException('Estudiante no encontrado o no pertenece a la institución');
    }

    // Verificar que el docente existe y pertenece a la misma institución
    const teacher = await this.userModel.findOne({
      _id: createComplaintDto.teacher,
      institution: institutionId,
      userType: { $in: ['docente', 'tutor'] }
    });

    if (!teacher) {
      throw new NotFoundException('Docente no encontrado');
    }

    const complaintData: any = {
      ...createComplaintDto,
      student: new Types.ObjectId(studentId),
      institution: new Types.ObjectId(institutionId),
    };

    // Solo agregar rating si es una evaluación
    if (createComplaintDto.type === 'evaluacion' && createComplaintDto.rating) {
      complaintData.rating = createComplaintDto.rating;
    }

    const complaint = new this.complaintModel(complaintData);
    return await complaint.save();
  }

  async getComplaints(filterDto: FilterComplaintsDto, userId: string, userType: string): Promise<Complaint[]> {
    const filter: any = {};

    // Aplicar filtros
    if (filterDto.type) filter.type = filterDto.type;
    if (filterDto.status) filter.status = filterDto.status;
    if (filterDto.category) filter.category = filterDto.category;
    if (filterDto.teacher) filter.teacher = new Types.ObjectId(filterDto.teacher);
    if (filterDto.student) filter.student = new Types.ObjectId(filterDto.student);
    if (filterDto.institution) filter.institution = new Types.ObjectId(filterDto.institution);

    // Filtros basados en el tipo de usuario
    if (userType === 'estudiante') {
      filter.student = new Types.ObjectId(userId);
    } else if (userType === 'docente' || userType === 'tutor') {
      filter.teacher = new Types.ObjectId(userId);
    }
    // Staff académico y administradores pueden ver todas las quejas de su institución

    return await this.complaintModel
      .find(filter)
      .populate('student', 'firstName lastName email')
      .populate('teacher', 'firstName lastName email userType')
      .populate('subject', 'name code')
      .populate('group', 'name code')
      .populate('resolvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getComplaintById(complaintId: string, userId: string, userType: string): Promise<Complaint> {
    const complaint = await this.complaintModel
      .findById(complaintId)
      .populate('student', 'firstName lastName email')
      .populate('teacher', 'firstName lastName email userType')
      .populate('subject', 'name code')
      .populate('group', 'name code')
      .populate('resolvedBy', 'firstName lastName')
      .exec();

    if (!complaint) {
      throw new NotFoundException('Queja/evaluación no encontrada');
    }

    // Verificar permisos de acceso
    this.checkComplaintAccess(complaint, userId, userType);

    return complaint;
  }

  async updateComplaint(
    complaintId: string, 
    updateComplaintDto: UpdateComplaintDto, 
    userId: string, 
    userType: string
  ): Promise<Complaint> {
    const complaint = await this.complaintModel.findById(complaintId);
    
    if (!complaint) {
      throw new NotFoundException('Queja/evaluación no encontrada');
    }

    // Solo el estudiante creador puede modificar quejas pendientes
    if (userType === 'estudiante') {
      if (!complaint.student.equals(new Types.ObjectId(userId))) {
        throw new ForbiddenException('No tienes permisos para modificar esta queja');
      }
      if (complaint.status !== 'pendiente') {
        throw new ForbiddenException('Solo se pueden modificar quejas pendientes');
      }
    }

    const updateData: any = { ...updateComplaintDto };

    // Staff académico puede cambiar estado y resolución
    if (['jefe-departamento', 'coordinador-tutorias', 'subdireccion-academica', 'administrador'].includes(userType)) {
      if (updateComplaintDto.status === 'resuelta' && updateComplaintDto.resolution) {
        updateData.resolvedBy = new Types.ObjectId(userId);
        updateData.resolvedAt = new Date();
      }
      
      // Si se cambia el estado a cualquier otro diferente de resuelta, limpiar resolvedBy y resolvedAt
      if (updateComplaintDto.status && updateComplaintDto.status !== 'resuelta') {
        updateData.resolvedBy = null;
        updateData.resolvedAt = null;
      }
    }

    const updatedComplaint = await this.complaintModel
      .findByIdAndUpdate(complaintId, updateData, { new: true })
      .populate('student', 'firstName lastName email')
      .populate('teacher', 'firstName lastName email userType')
      .populate('subject', 'name code')
      .populate('group', 'name code')
      .populate('resolvedBy', 'firstName lastName')
      .exec();

    if (!updatedComplaint) {
      throw new NotFoundException('Queja/evaluación no encontrada después de actualizar');
    }

    return updatedComplaint;
  }

  async deleteComplaint(complaintId: string, userId: string, userType: string): Promise<{ message: string }> {
    const complaint = await this.complaintModel.findById(complaintId);
    
    if (!complaint) {
      throw new NotFoundException('Queja/evaluación no encontrada');
    }

    // Solo el estudiante creador o staff académico puede eliminar
    if (userType === 'estudiante') {
      if (!complaint.student.equals(new Types.ObjectId(userId))) {
        throw new ForbiddenException('No tienes permisos para eliminar esta queja');
      }
      if (complaint.status !== 'pendiente') {
        throw new ForbiddenException('Solo se pueden eliminar quejas pendientes');
      }
    }

    const result = await this.complaintModel.findByIdAndDelete(complaintId);
    
    if (!result) {
      throw new NotFoundException('Queja/evaluación no encontrada para eliminar');
    }

    return { message: 'Queja/evaluación eliminada correctamente' };
  }

  async getComplaintStats(institutionId: string): Promise<any> {
    const stats = await this.complaintModel.aggregate([
      {
        $match: { institution: new Types.ObjectId(institutionId) }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await this.complaintModel.aggregate([
      {
        $match: { institution: new Types.ObjectId(institutionId) }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    const categoryStats = await this.complaintModel.aggregate([
      {
        $match: { institution: new Types.ObjectId(institutionId) }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await this.complaintModel.countDocuments({ institution: new Types.ObjectId(institutionId) });

    return {
      byStatus: stats,
      byType: typeStats,
      byCategory: categoryStats,
      total: total
    };
  }

  private checkComplaintAccess(complaint: Complaint, userId: string, userType: string): void {
    const userObjectId = new Types.ObjectId(userId);

    if (userType === 'estudiante') {
      if (!complaint.student.equals(userObjectId)) {
        throw new ForbiddenException('No tienes acceso a esta queja/evaluación');
      }
    } else if (userType === 'docente' || userType === 'tutor') {
      if (!complaint.teacher.equals(userObjectId)) {
        throw new ForbiddenException('No tienes acceso a esta queja/evaluación');
      }
    }
    // Staff académico y administradores tienen acceso a todas las quejas de su institución
  }
}