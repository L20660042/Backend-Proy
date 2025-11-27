import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subject } from './subject.schema';
import { CreateSubjectDto } from './DTO/create-subject.dto';
import { UpdateSubjectDto } from './DTO/update-subject.dto';
import { AssignTeacherDto, AssignTeachersDto } from './DTO/assign-teacher.dto';
import { FilterSubjectsDto } from './DTO/filter-subjects.dto';
import { User } from '../users/user.schema';

@Injectable()
export class SubjectsService {
  constructor(
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async createSubject(createSubjectDto: CreateSubjectDto, userId: string, institutionId: string): Promise<Subject> {
    // Verificar permisos del usuario
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: { $in: ['jefe-departamento', 'subdireccion-academica', 'administrador'] }
    });

    if (!user) {
      throw new ForbiddenException('No tienes permisos para crear materias');
    }

    // Verificar que el código de la materia sea único en la institución
    const existingSubject = await this.subjectModel.findOne({
      code: createSubjectDto.code,
      institution: new Types.ObjectId(institutionId)
    });

    if (existingSubject) {
      throw new BadRequestException('Ya existe una materia con este código en la institución');
    }

    const subjectData: any = {
      ...createSubjectDto,
      institution: new Types.ObjectId(institutionId),
      createdBy: new Types.ObjectId(userId),
    };

    // Validar y asignar docente si se proporciona
    if (createSubjectDto.assignedTeacher) {
      const teacher = await this.validateUserByTypes(createSubjectDto.assignedTeacher, institutionId, ['docente', 'tutor']);
      subjectData.assignedTeacher = teacher._id;
    }

    // Validar availableTeachers si se proporcionan
    if (createSubjectDto.availableTeachers && createSubjectDto.availableTeachers.length > 0) {
      const teachers = await this.validateUsers(createSubjectDto.availableTeachers, institutionId, ['docente', 'tutor']);
      subjectData.availableTeachers = teachers.map(teacher => teacher._id);
    } else {
      subjectData.availableTeachers = [];
    }

    const subject = new this.subjectModel(subjectData);
    return await subject.save();
  }

  async getSubjects(filterDto: FilterSubjectsDto, institutionId: string): Promise<Subject[]> {
    const filter: any = { institution: new Types.ObjectId(institutionId) };

    // Aplicar filtros
    if (filterDto.area) filter.area = filterDto.area;
    if (filterDto.type) filter.type = filterDto.type;
    if (filterDto.isActive !== undefined) filter.isActive = filterDto.isActive;

    // Filtro por docente
    if (filterDto.teacher) {
      const teacherId = new Types.ObjectId(filterDto.teacher);
      filter.$or = [
        { assignedTeacher: teacherId },
        { availableTeachers: teacherId }
      ];
    }

    return await this.subjectModel
      .find(filter)
      .populate('assignedTeacher', 'firstName lastName email userType specialty')
      .populate('availableTeachers', 'firstName lastName email userType')
      .populate('createdBy', 'firstName lastName email')
      .sort({ area: 1, name: 1 })
      .exec();
  }

  async getSubjectById(subjectId: string, institutionId: string): Promise<Subject> {
    const subject = await this.subjectModel
      .findOne({
        _id: new Types.ObjectId(subjectId),
        institution: new Types.ObjectId(institutionId)
      })
      .populate('assignedTeacher', 'firstName lastName email userType specialty phone')
      .populate('availableTeachers', 'firstName lastName email userType phone')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    return subject;
  }

  async updateSubject(
    subjectId: string, 
    updateSubjectDto: UpdateSubjectDto, 
    userId: string, 
    institutionId: string
  ): Promise<Subject> {
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Verificar permisos
    await this.checkSubjectModificationPermissions(userId, institutionId);

    const updateData: any = { ...updateSubjectDto };

    // Validar y actualizar docente asignado si se proporciona
    if (updateSubjectDto.assignedTeacher !== undefined) {
      if (updateSubjectDto.assignedTeacher) {
        const teacher = await this.validateUserByTypes(updateSubjectDto.assignedTeacher, institutionId, ['docente', 'tutor']);
        updateData.assignedTeacher = teacher._id;
      } else {
        // Usar $unset para eliminar el campo cuando se asigna null
        updateData.$unset = { assignedTeacher: 1 };
      }
    }

    // Validar availableTeachers si se proporcionan
    if (updateSubjectDto.availableTeachers !== undefined) {
      if (updateSubjectDto.availableTeachers && updateSubjectDto.availableTeachers.length > 0) {
        const teachers = await this.validateUsers(updateSubjectDto.availableTeachers, institutionId, ['docente', 'tutor']);
        updateData.availableTeachers = teachers.map(teacher => teacher._id);
      } else {
        updateData.availableTeachers = [];
      }
    }

    // Usar findOneAndUpdate para manejar correctamente $unset
    const updatedSubject = await this.subjectModel
      .findOneAndUpdate(
        { _id: new Types.ObjectId(subjectId), institution: new Types.ObjectId(institutionId) },
        updateData,
        { new: true }
      )
      .populate('assignedTeacher', 'firstName lastName email userType specialty')
      .populate('availableTeachers', 'firstName lastName email userType')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!updatedSubject) {
      throw new NotFoundException('Materia no encontrada después de actualizar');
    }

    return updatedSubject;
  }

  async deleteSubject(subjectId: string, userId: string, institutionId: string): Promise<{ message: string }> {
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Verificar permisos
    await this.checkSubjectModificationPermissions(userId, institutionId);

    // Verificar que la materia no esté asignada a ningún grupo
    const groupsWithSubject = await this.checkIfSubjectIsAssignedToGroups(subjectId);
    if (groupsWithSubject) {
      throw new BadRequestException('No se puede eliminar una materia que está asignada a grupos');
    }

    await this.subjectModel.findByIdAndDelete(new Types.ObjectId(subjectId));
    return { message: 'Materia eliminada correctamente' };
  }

  async assignTeacherToSubject(
    subjectId: string, 
    assignTeacherDto: AssignTeacherDto, 
    userId: string, 
    institutionId: string
  ): Promise<Subject> {
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Verificar permisos
    await this.checkSubjectModificationPermissions(userId, institutionId);

    // Validar docente
    const teacher = await this.validateUserByTypes(assignTeacherDto.teacherId, institutionId, ['docente', 'tutor']);

    // Asignar docente a la materia
    subject.assignedTeacher = teacher._id as Types.ObjectId;

    // Agregar a availableTeachers si no está
    const isInAvailableTeachers = subject.availableTeachers?.some(teacherId => 
      teacherId.equals(teacher._id as Types.ObjectId)
    ) || false;

    if (!isInAvailableTeachers) {
      if (!subject.availableTeachers) {
        subject.availableTeachers = [];
      }
      subject.availableTeachers.push(teacher._id as Types.ObjectId);
    }

    return await subject.save();
  }

  async addAvailableTeachers(
    subjectId: string, 
    assignTeachersDto: AssignTeachersDto, 
    userId: string, 
    institutionId: string
  ): Promise<any> {
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Verificar permisos
    await this.checkSubjectModificationPermissions(userId, institutionId);

    // Validar docentes
    const teachers = await this.validateUsers(assignTeachersDto.teacherIds, institutionId, ['docente', 'tutor']);

    const results = {
      added: 0,
      alreadyAssigned: 0,
      errors: [] as string[]
    };

    // Inicializar availableTeachers si es undefined
    if (!subject.availableTeachers) {
      subject.availableTeachers = [];
    }

    for (const teacher of teachers) {
      try {
        // Verificar si el docente ya está en availableTeachers
        const isAlreadyAssigned = subject.availableTeachers.some(teacherId => 
          teacherId.equals(teacher._id as Types.ObjectId)
        );

        if (isAlreadyAssigned) {
          results.alreadyAssigned++;
          continue;
        }

        // Agregar docente a availableTeachers
        subject.availableTeachers.push(teacher._id as Types.ObjectId);
        results.added++;
      } catch (error) {
        results.errors.push(`Error con docente ${teacher.firstName} ${teacher.lastName}: ${error.message}`);
      }
    }

    const savedSubject = await subject.save();
    
    return {
      subject: savedSubject,
      assignmentResults: results
    };
  }

  async removeTeacherFromSubject(
    subjectId: string, 
    teacherId: string, 
    userId: string, 
    institutionId: string
  ): Promise<Subject> {
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    // Verificar permisos
    await this.checkSubjectModificationPermissions(userId, institutionId);

    const teacherObjectId = new Types.ObjectId(teacherId);

    // Remover docente de availableTeachers (si existe el array)
    if (subject.availableTeachers) {
      subject.availableTeachers = subject.availableTeachers.filter(id => !id.equals(teacherObjectId));
    }

    // Si el docente era el assignedTeacher, limpiar el campo usando $unset
    if (subject.assignedTeacher && subject.assignedTeacher.equals(teacherObjectId)) {
      await this.subjectModel.findByIdAndUpdate(
        subject._id,
        { $unset: { assignedTeacher: 1 } }
      );
      subject.assignedTeacher = undefined;
    }

    return await subject.save();
  }

  async getMySubjects(userId: string, institutionId: string): Promise<Subject[]> {
    const teacherObjectId = new Types.ObjectId(userId);

    return await this.subjectModel
      .find({
        institution: new Types.ObjectId(institutionId),
        isActive: true,
        $or: [
          { assignedTeacher: teacherObjectId },
          { availableTeachers: teacherObjectId }
        ]
      })
      .populate('assignedTeacher', 'firstName lastName email userType')
      .populate('availableTeachers', 'firstName lastName email userType')
      .populate('createdBy', 'firstName lastName email')
      .sort({ name: 1 })
      .exec();
  }

  async getSubjectStats(institutionId: string): Promise<any> {
    const stats = await this.subjectModel.aggregate([
      {
        $match: { 
          institution: new Types.ObjectId(institutionId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$area',
          totalSubjects: { $sum: 1 },
          totalCredits: { $sum: '$credits' },
          averageCredits: { $avg: '$credits' }
        }
      }
    ]);

    const typeStats = await this.subjectModel.aggregate([
      {
        $match: { 
          institution: new Types.ObjectId(institutionId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$type',
          totalSubjects: { $sum: 1 }
        }
      }
    ]);

    const totalSubjects = await this.subjectModel.countDocuments({
      institution: new Types.ObjectId(institutionId),
      isActive: true
    });

    const subjectsWithTeachers = await this.subjectModel.countDocuments({
      institution: new Types.ObjectId(institutionId),
      isActive: true,
      assignedTeacher: { $ne: null }
    });

    return {
      byArea: stats,
      byType: typeStats,
      totalSubjects,
      subjectsWithTeachers,
      subjectsWithoutTeachers: totalSubjects - subjectsWithTeachers
    };
  }

  // Método para validar usuario con tipos específicos (acepta array)
  private async validateUserByTypes(userId: string, institutionId: string, userTypes: string[]): Promise<User> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: { $in: userTypes }
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado o tipo de usuario inválido. Tipos permitidos: ${userTypes.join(', ')}`);
    }

    return user;
  }

  // Método para validar usuario con un solo tipo
  private async validateUser(userId: string, institutionId: string, userType: string): Promise<User> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: userType
    });

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado o tipo de usuario inválido. Tipo requerido: ${userType}`);
    }

    return user;
  }

  private async validateUsers(userIds: string[], institutionId: string, userTypes: string[]): Promise<User[]> {
    const objectIds = userIds.map(id => new Types.ObjectId(id));
    
    const users = await this.userModel.find({
      _id: { $in: objectIds },
      institution: new Types.ObjectId(institutionId),
      userType: { $in: userTypes }
    });

    if (users.length !== userIds.length) {
      throw new NotFoundException('Uno o más docentes no fueron encontrados');
    }

    return users;
  }

  private async checkSubjectModificationPermissions(userId: string, institutionId: string): Promise<void> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: { $in: ['jefe-departamento', 'subdireccion-academica', 'administrador'] }
    });

    if (!user) {
      throw new ForbiddenException('No tienes permisos para modificar materias');
    }
  }

  private async checkIfSubjectIsAssignedToGroups(subjectId: string): Promise<boolean> {
    // Esta función verificaría si la materia está asignada a algún grupo
    // Por ahora retornamos false, en una implementación real necesitarías
    // importar el modelo de Group y verificar
    return false;
  }
}