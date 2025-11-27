import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group } from './group.schema';
import { CreateGroupDto } from './DTO/create-group.dto';
import { UpdateGroupDto } from './DTO/update-group.dto';
import { AssignStudentsDto, AssignStudentDto } from './DTO/assign-student.dto';
import { AssignSubjectDto } from './DTO/assign-subject.dto';
import { FilterGroupsDto } from './DTO/filter-groups.dto';
import { User } from '../users/user.schema';
import { Subject } from '../subjects/subject.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<Group>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Subject.name) private subjectModel: Model<Subject>,
  ) {}

  async createGroup(createGroupDto: CreateGroupDto, userId: string, institutionId: string): Promise<Group> {
    // Verificar permisos del usuario
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: { $in: ['jefe-departamento', 'subdireccion-academica', 'administrador'] }
    });

    if (!user) {
      throw new ForbiddenException('No tienes permisos para crear grupos');
    }

    // Verificar que el código del grupo sea único en la institución
    const existingGroup = await this.groupModel.findOne({
      code: createGroupDto.code,
      institution: new Types.ObjectId(institutionId)
    });

    if (existingGroup) {
      throw new BadRequestException('Ya existe un grupo con este código en la institución');
    }

    const groupData: any = {
      ...createGroupDto,
      institution: new Types.ObjectId(institutionId),
      createdBy: new Types.ObjectId(userId),
    };

    // Validar y asignar estudiantes si se proporcionan
    if (createGroupDto.students && createGroupDto.students.length > 0) {
      const students = await this.validateUsers(createGroupDto.students, institutionId, 'estudiante');
      groupData.students = students.map(student => student._id);
    }

    // Validar y asignar tutores/maestros si se proporcionan
    if (createGroupDto.tutor) {
      const tutor = await this.validateUser(createGroupDto.tutor, institutionId, ['tutor', 'docente']);
      groupData.tutor = tutor._id;
    }

    if (createGroupDto.headTeacher) {
      const headTeacher = await this.validateUser(createGroupDto.headTeacher, institutionId, ['docente', 'jefe-departamento']);
      groupData.headTeacher = headTeacher._id;
    }

    // Validar assignedSubjects si se proporcionan
    if (createGroupDto.assignedSubjects && createGroupDto.assignedSubjects.length > 0) {
      groupData.assignedSubjects = [];
      for (const assignedSubject of createGroupDto.assignedSubjects) {
        const subject = await this.subjectModel.findOne({
          _id: new Types.ObjectId(assignedSubject.subject),
          institution: new Types.ObjectId(institutionId)
        });

        if (!subject) {
          throw new NotFoundException(`Materia ${assignedSubject.subject} no encontrada`);
        }

        const teacher = await this.validateUser(assignedSubject.teacher, institutionId, ['docente', 'tutor']);

        groupData.assignedSubjects.push({
          subject: subject._id,
          teacher: teacher._id,
          schedule: assignedSubject.schedule
        });
      }
    }

    const group = new this.groupModel(groupData);
    return await group.save();
  }

  async getGroups(filterDto: FilterGroupsDto, institutionId: string): Promise<Group[]> {
    const filter: any = { institution: new Types.ObjectId(institutionId) };

    // Aplicar filtros
    if (filterDto.grade) filter.grade = filterDto.grade;
    if (filterDto.level) filter.level = filterDto.level;
    if (filterDto.semester) filter.semester = filterDto.semester;
    if (filterDto.shift) filter.shift = filterDto.shift;
    if (filterDto.isActive !== undefined) filter.isActive = filterDto.isActive;

    // Filtros por relaciones
    if (filterDto.teacher) {
      const teacherId = new Types.ObjectId(filterDto.teacher);
      filter.$or = [
        { teachers: teacherId },
        { 'assignedSubjects.teacher': teacherId }
      ];
    }

    if (filterDto.tutor) {
      filter.tutor = new Types.ObjectId(filterDto.tutor);
    }

    if (filterDto.student) {
      filter.students = new Types.ObjectId(filterDto.student);
    }

    return await this.groupModel
      .find(filter)
      .populate('students', 'firstName lastName email studentId')
      .populate('teachers', 'firstName lastName email userType')
      .populate('tutor', 'firstName lastName email')
      .populate('headTeacher', 'firstName lastName email')
      .populate('assignedSubjects.subject', 'name code credits')
      .populate('assignedSubjects.teacher', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName')
      .sort({ grade: 1, name: 1 })
      .exec();
  }

  async getGroupById(groupId: string, institutionId: string): Promise<Group> {
    const group = await this.groupModel
      .findOne({
        _id: new Types.ObjectId(groupId),
        institution: new Types.ObjectId(institutionId)
      })
      .populate('students', 'firstName lastName email studentId enrollmentGroup')
      .populate('teachers', 'firstName lastName email userType specialty')
      .populate('tutor', 'firstName lastName email phone')
      .populate('headTeacher', 'firstName lastName email phone')
      .populate('assignedSubjects.subject', 'name code credits description')
      .populate('assignedSubjects.teacher', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    return group;
  }

  async updateGroup(
    groupId: string, 
    updateGroupDto: UpdateGroupDto, 
    userId: string, 
    institutionId: string
  ): Promise<Group> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    const updateData: any = { ...updateGroupDto };

    // Validar y actualizar estudiantes si se proporcionan
    if (updateGroupDto.students && updateGroupDto.students.length > 0) {
      const students = await this.validateUsers(updateGroupDto.students, institutionId, 'estudiante');
      updateData.students = students.map(student => student._id);
    }

    // Validar tutores/maestros si se proporcionan
    if (updateGroupDto.tutor) {
      const tutor = await this.validateUser(updateGroupDto.tutor, institutionId, ['tutor', 'docente']);
      updateData.tutor = tutor._id;
    }

    if (updateGroupDto.headTeacher) {
      const headTeacher = await this.validateUser(updateGroupDto.headTeacher, institutionId, ['docente', 'jefe-departamento']);
      updateData.headTeacher = headTeacher._id;
    }

    // Validar assignedSubjects si se proporcionan
    if (updateGroupDto.assignedSubjects && updateGroupDto.assignedSubjects.length > 0) {
      updateData.assignedSubjects = [];
      for (const assignedSubject of updateGroupDto.assignedSubjects) {
        const subject = await this.subjectModel.findOne({
          _id: new Types.ObjectId(assignedSubject.subject),
          institution: new Types.ObjectId(institutionId)
        });

        if (!subject) {
          throw new NotFoundException(`Materia ${assignedSubject.subject} no encontrada`);
        }

        const teacher = await this.validateUser(assignedSubject.teacher, institutionId, ['docente', 'tutor']);

        updateData.assignedSubjects.push({
          subject: subject._id,
          teacher: teacher._id,
          schedule: assignedSubject.schedule
        });
      }
    }

    const updatedGroup = await this.groupModel
      .findByIdAndUpdate(new Types.ObjectId(groupId), updateData, { new: true })
      .populate('students', 'firstName lastName email studentId')
      .populate('teachers', 'firstName lastName email userType')
      .populate('tutor', 'firstName lastName email')
      .populate('headTeacher', 'firstName lastName email')
      .populate('assignedSubjects.subject', 'name code credits')
      .populate('assignedSubjects.teacher', 'firstName lastName email')
      .exec();

    if (!updatedGroup) {
      throw new NotFoundException('Grupo no encontrado después de actualizar');
    }

    return updatedGroup;
  }

  async deleteGroup(groupId: string, userId: string, institutionId: string): Promise<{ message: string }> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    // Verificar que el grupo no tenga estudiantes asignados
    if (group.students.length > 0) {
      throw new BadRequestException('No se puede eliminar un grupo que tiene estudiantes asignados');
    }

    await this.groupModel.findByIdAndDelete(new Types.ObjectId(groupId));
    return { message: 'Grupo eliminado correctamente' };
  }

  async assignStudentToGroup(
    groupId: string, 
    assignStudentDto: AssignStudentDto, 
    userId: string, 
    institutionId: string
  ): Promise<Group> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    // Validar estudiante
    const student = await this.validateUser(assignStudentDto.studentId, institutionId, 'estudiante');

    // Verificar si el estudiante ya está en el grupo
    const isAlreadyInGroup = group.students.some(studentId => 
      studentId.equals(student._id as Types.ObjectId)
    );

    if (isAlreadyInGroup) {
      throw new BadRequestException('El estudiante ya está asignado a este grupo');
    }

    // Verificar capacidad del grupo
    if (group.capacity && group.students.length >= group.capacity) {
      throw new BadRequestException('El grupo ha alcanzado su capacidad máxima');
    }

    // Agregar estudiante al grupo
    group.students.push(student._id as Types.ObjectId);
    
    // Actualizar el grupo del estudiante
    await this.userModel.findByIdAndUpdate(student._id, {
      enrollmentGroup: group.name
    });

    return await group.save();
  }

  async assignStudentsToGroup(
    groupId: string, 
    assignStudentsDto: AssignStudentsDto, 
    userId: string, 
    institutionId: string
  ): Promise<any> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    // Validar estudiantes
    const students = await this.validateUsers(assignStudentsDto.studentIds, institutionId, 'estudiante');

    const results = {
      added: 0,
      alreadyInGroup: 0,
      errors: [] as string[]
    };

    for (const student of students) {
      try {
        // Verificar si el estudiante ya está en el grupo
        const isAlreadyInGroup = group.students.some(studentId => 
          studentId.equals(student._id as Types.ObjectId)
        );

        if (isAlreadyInGroup) {
          results.alreadyInGroup++;
          continue;
        }

        // Verificar capacidad del grupo
        if (group.capacity && group.students.length >= group.capacity) {
          results.errors.push(`Capacidad máxima alcanzada para el estudiante ${student.firstName} ${student.lastName}`);
          continue;
        }

        // Agregar estudiante al grupo
        group.students.push(student._id as Types.ObjectId);
        
        // Actualizar el grupo del estudiante
        await this.userModel.findByIdAndUpdate(student._id, {
          enrollmentGroup: group.name
        });

        results.added++;
      } catch (error) {
        results.errors.push(`Error con estudiante ${student.firstName} ${student.lastName}: ${error.message}`);
      }
    }

    const savedGroup = await group.save();
    
    return {
      group: savedGroup,
      assignmentResults: results
    };
  }

  async removeStudentFromGroup(
    groupId: string, 
    studentId: string, 
    userId: string, 
    institutionId: string
  ): Promise<Group> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    const studentObjectId = new Types.ObjectId(studentId);

    // Remover estudiante del grupo
    group.students = group.students.filter(id => !id.equals(studentObjectId));

    // Actualizar el estudiante
    await this.userModel.findByIdAndUpdate(studentObjectId, {
      $unset: { enrollmentGroup: 1 }
    });

    return await group.save();
  }

  async assignSubjectToGroup(
    groupId: string, 
    assignSubjectDto: AssignSubjectDto, 
    userId: string, 
    institutionId: string
  ): Promise<Group> {
    const group = await this.groupModel.findOne({
      _id: new Types.ObjectId(groupId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!group) {
      throw new NotFoundException('Grupo no encontrado');
    }

    // Verificar permisos
    await this.checkGroupModificationPermissions(userId, institutionId);

    // Validar materia y docente
    const subject = await this.subjectModel.findOne({
      _id: new Types.ObjectId(assignSubjectDto.subjectId),
      institution: new Types.ObjectId(institutionId)
    });

    if (!subject) {
      throw new NotFoundException('Materia no encontrada');
    }

    const teacher = await this.validateUser(assignSubjectDto.teacherId, institutionId, ['docente', 'tutor']);

    // Verificar si la materia ya está asignada al grupo
    const existingAssignment = group.assignedSubjects.find(assignment => 
      (assignment.subject as Types.ObjectId).equals(subject._id as Types.ObjectId)
    );

    if (existingAssignment) {
      throw new BadRequestException('Esta materia ya está asignada al grupo');
    }

    // Agregar materia asignada
    group.assignedSubjects.push({
      subject: subject._id as Types.ObjectId,
      teacher: teacher._id as Types.ObjectId,
      schedule: assignSubjectDto.schedule
    });

    // Agregar docente a la lista de teachers si no está
    const isTeacherInGroup = group.teachers.some(teacherId => 
      teacherId.equals(teacher._id as Types.ObjectId)
    );

    if (!isTeacherInGroup) {
      group.teachers.push(teacher._id as Types.ObjectId);
    }

    return await group.save();
  }

  async getGroupStats(institutionId: string): Promise<any> {
    const stats = await this.groupModel.aggregate([
      {
        $match: { 
          institution: new Types.ObjectId(institutionId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$grade',
          totalGroups: { $sum: 1 },
          totalStudents: { $sum: { $size: '$students' } },
          averageStudents: { $avg: { $size: '$students' } }
        }
      }
    ]);

    const levelStats = await this.groupModel.aggregate([
      {
        $match: { 
          institution: new Types.ObjectId(institutionId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: '$level',
          totalGroups: { $sum: 1 },
          totalStudents: { $sum: { $size: '$students' } }
        }
      }
    ]);

    const totalGroups = await this.groupModel.countDocuments({
      institution: new Types.ObjectId(institutionId),
      isActive: true
    });

    const totalStudentsResult = await this.groupModel.aggregate([
      {
        $match: { 
          institution: new Types.ObjectId(institutionId),
          isActive: true 
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $size: '$students' } }
        }
      }
    ]);

    return {
      byGrade: stats,
      byLevel: levelStats,
      totalGroups,
      totalStudents: totalStudentsResult[0]?.total || 0
    };
  }

  private async validateUser(userId: string, institutionId: string, userType: string | string[]): Promise<User> {
    const query: any = {
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId)
    };

    if (Array.isArray(userType)) {
      query.userType = { $in: userType };
    } else {
      query.userType = userType;
    }

    const user = await this.userModel.findOne(query);

    if (!user) {
      throw new NotFoundException(`Usuario no encontrado o tipo de usuario inválido`);
    }

    return user;
  }

  private async validateUsers(userIds: string[], institutionId: string, userType: string): Promise<User[]> {
    const objectIds = userIds.map(id => new Types.ObjectId(id));
    
    const users = await this.userModel.find({
      _id: { $in: objectIds },
      institution: new Types.ObjectId(institutionId),
      userType: userType
    });

    if (users.length !== userIds.length) {
      throw new NotFoundException('Uno o más estudiantes no fueron encontrados');
    }

    return users;
  }

  private async checkGroupModificationPermissions(userId: string, institutionId: string): Promise<void> {
    const user = await this.userModel.findOne({
      _id: new Types.ObjectId(userId),
      institution: new Types.ObjectId(institutionId),
      userType: { $in: ['jefe-departamento', 'subdireccion-academica', 'administrador'] }
    });

    if (!user) {
      throw new ForbiddenException('No tienes permisos para modificar grupos');
    }
  }
}