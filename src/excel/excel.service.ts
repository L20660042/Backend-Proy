import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { UsersService } from '../users/users.service';
import { CareersService } from '../careers/careers.service';
import { SubjectsService } from '../subjects/subjects.service';
import { GroupsService } from '../groups/groups.service';
import { TutoriaService } from '../tutoria/tutoria.service';
import { CapacitacionService } from '../capacitacion/capacitacion.service';
import { AlertsService } from '../alerts/alerts.service';
import { hashPassword } from '../common/utils';
import { UserDocument } from '../users/schemas/user.schema';
import { CareerDocument } from '../careers/schemas/career.schema';
import { SubjectDocument } from '../subjects/schemas/subject.schema';
import { GroupDocument } from '../groups/schemas/group.schema';
import { ObjectId } from 'mongoose';

@Injectable()
export class ExcelService {
  constructor(
    private readonly usersService: UsersService,
    private readonly careersService: CareersService,
    private readonly subjectsService: SubjectsService,
    private readonly groupsService: GroupsService,
    private readonly tutoriaService: TutoriaService,
    private readonly capacitacionService: CapacitacionService,
    private readonly alertsService: AlertsService,
  ) {}

  async importExcel(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo Excel no proporcionado');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const result: Record<string, any> = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);

      switch (sheetName.toLowerCase()) {
        case 'usuarios':
          result['usuarios'] = await this.importUsers(data);
          break;
        case 'carreras':
          result['carreras'] = await this.importCareers(data);
          break;
        case 'materias':
        case 'subjects':
          result['materias'] = await this.importSubjects(data);
          break;
        case 'grupos':
        case 'groups':
          result['grupos'] = await this.importGroups(data);
          break;
        // Agregar más hojas si es necesario
        default:
          console.warn(`Hoja ${sheetName} ignorada`);
      }
    }

    return result;
  }

  /** Importa usuarios y encripta la contraseña */
  private async importUsers(data: any[]): Promise<UserDocument[]> {
    const created: UserDocument[] = [];
    for (const row of data) {
      if (!row.email || !row.password || !row.role) continue;

      const hashedPassword = await hashPassword(row.password);

      const user = await this.usersService.create({
        fullName: row.fullName || row.name || '',
        email: row.email,
        password: hashedPassword,
        role: row.role,
        active: row.active ?? true,
      });
      created.push(user);
    }
    return created;
  }

  private async importCareers(data: any[]): Promise<CareerDocument[]> {
    const created: CareerDocument[] = [];
    for (const row of data) {
      if (!row.name) continue;

      const career = await this.careersService.create({
        name: row.name,
        code: row.code || row.name.substring(0, 3).toUpperCase(),
      });
      created.push(career);
    }
    return created;
  }

  private async importSubjects(data: any[]): Promise<SubjectDocument[]> {
    const created: SubjectDocument[] = [];
    for (const row of data) {
      if (!row.name || !row.careerId) continue;

      const subject = await this.subjectsService.create({
        name: row.name,
        career: row.careerId,
        code: row.code || row.name.substring(0, 3).toUpperCase(),
      });
      created.push(subject);
    }
    return created;
  }

  private async importGroups(data: any[]): Promise<GroupDocument[]> {
    const created: GroupDocument[] = [];
    for (const row of data) {
      if (!row.name || !row.subjectId) continue;

      const group = await this.groupsService.create({
        name: row.name,
        subject: row.subjectId,
        teacher: row.teacherId || null,
        active: row.active ?? true,
      });

      // Vincular estudiantes si se proporciona (array de IDs separados por coma)
      if (row.students) {
        const groupId = (group._id as ObjectId).toString();
        const studentIds = row.students.toString().split(',').map((id) => id.trim());
        await this.groupsService.addStudents(groupId, studentIds);
      }

      created.push(group);
    }
    return created;
  }
}