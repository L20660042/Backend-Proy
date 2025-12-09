import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { Types } from 'mongoose';
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

    // Validar formato del archivo
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['xlsx', 'xls', 'csv'];
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Formato de archivo no soportado. Use: ${allowedExtensions.join(', ')}`,
      );
    }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const result: Record<string, any> = {
      summary: {
        totalSheets: workbook.SheetNames.length,
        processedSheets: 0,
        errors: [],
      },
      details: {},
    };

    // Importar en orden específico para manejar dependencias
    const importOrder = ['carreras', 'usuarios', 'materias', 'grupos'];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      const normalizedSheetName = sheetName.toLowerCase().trim();

      try {
        switch (normalizedSheetName) {
          case 'usuarios':
          case 'users':
            result.details['usuarios'] = await this.importUsers(data);
            result.summary.processedSheets++;
            break;
          case 'carreras':
          case 'careers':
            result.details['carreras'] = await this.importCareers(data);
            result.summary.processedSheets++;
            break;
          case 'materias':
          case 'subjects':
          case 'materia':
          case 'subject':
            result.details['materias'] = await this.importSubjects(data);
            result.summary.processedSheets++;
            break;
          case 'grupos':
          case 'groups':
          case 'grupo':
          case 'group':
            result.details['grupos'] = await this.importGroups(data);
            result.summary.processedSheets++;
            break;
          default:
            console.warn(`⚠️ Hoja "${sheetName}" ignorada - no reconocida`);
            result.summary.errors.push(`Hoja "${sheetName}" ignorada`);
        }
      } catch (error: any) {
        console.error(`❌ Error procesando hoja ${sheetName}:`, error.message);
        result.summary.errors.push(`Error en hoja "${sheetName}": ${error.message}`);
      }
    }

    result.summary.success = result.summary.errors.length === 0;
    result.summary.message = result.summary.success
      ? 'Importación completada exitosamente'
      : 'Importación completada con errores';

    return result;
  }

  /** Importa usuarios - Mejorado para manejar diferentes formatos */
  private async importUsers(data: any[]): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la fila 1 es encabezado

      try {
        // Validaciones básicas
        if (!row.email || !row.role) {
          result.errors.push(`Fila ${rowNumber}: Email y rol son requeridos`);
          continue;
        }

        // Formatear datos
        const userData: any = {
          email: row.email.toString().trim().toLowerCase(),
          role: row.role.toString().toUpperCase(),
          active: row.active !== undefined ? Boolean(row.active) : true,
        };

        // Manejar nombre completo vs nombre/apellido separados
        if (row.fullName) {
          userData.fullName = row.fullName.toString().trim();
        } else if (row.firstName && row.lastName) {
          userData.fullName = `${row.firstName} ${row.lastName}`.trim();
          userData.firstName = row.firstName.toString().trim();
          userData.lastName = row.lastName.toString().trim();
        } else if (row.name) {
          userData.fullName = row.name.toString().trim();
        } else {
          result.errors.push(`Fila ${rowNumber}: Nombre requerido (fullName o firstName/lastName)`);
          continue;
        }

        // Contraseña - generar automáticamente si no se proporciona
        if (row.password) {
          userData.password = await hashPassword(row.password.toString());
        } else {
          // Contraseña por defecto: email + "123"
          userData.password = await hashPassword(`${userData.email}123`);
        }

        // Campos opcionales
        if (row.phone) userData.phone = row.phone.toString().trim();
        if (row.career) {
          // Intentar buscar carrera por nombre o código
          const careerId = await this.findCareerIdentifier(row.career.toString());
          if (careerId) {
            userData.career = careerId;
          } else {
            result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada`);
          }
        }

        // Crear usuario
        const existingUser = await this.usersService.findByEmail(userData.email);
        if (existingUser) {
          result.errors.push(`Fila ${rowNumber}: Email ${userData.email} ya existe`);
          continue;
        }

        await this.usersService.create(userData);
        result.created++;

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importa carreras */
  private async importCareers(data: any[]): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        if (!row.name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de carrera requerido`);
          continue;
        }

        const careerData = {
          name: row.name.toString().trim(),
          code: row.code ? row.code.toString().trim().toUpperCase() : 
                row.name.toString().substring(0, 3).toUpperCase(),
          description: row.description ? row.description.toString().trim() : '',
          duration: row.duration ? parseInt(row.duration) : 8,
        };

        // Verificar si ya existe
        const existing = await this.findCareerByNameOrCode(careerData.name, careerData.code);
        if (existing) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${careerData.name}" ya existe`);
          continue;
        }

        await this.careersService.create(careerData);
        result.created++;

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importa materias - MEJORADO para manejar nombres de carrera */
  private async importSubjects(data: any[]): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        if (!row.name || !row.career) {
          result.errors.push(`Fila ${rowNumber}: Nombre y carrera son requeridos`);
          continue;
        }

        // Buscar carrera por nombre, código o ID
        const careerId = await this.findCareerIdentifier(row.career.toString());
        if (!careerId) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada`);
          continue;
        }

        const subjectData = {
          name: row.name.toString().trim(),
          career: careerId,
          code: row.code ? row.code.toString().trim().toUpperCase() : 
                this.generateSubjectCode(row.name.toString()),
          credits: row.credits ? parseInt(row.credits) : 4,
          semester: row.semester ? parseInt(row.semester) : 1,
        };

        // Verificar si ya existe el código
        const existing = await this.findSubjectByCode(subjectData.code);
        if (existing) {
          result.errors.push(`Fila ${rowNumber}: Código de materia "${subjectData.code}" ya existe`);
          continue;
        }

        await this.subjectsService.create(subjectData);
        result.created++;

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importa grupos - MEJORADO para manejar referencias */
  private async importGroups(data: any[]): Promise<{ created: number; errors: string[] }> {
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        if (!row.name || !row.subject) {
          result.errors.push(`Fila ${rowNumber}: Nombre y materia son requeridos`);
          continue;
        }

        // Buscar materia por nombre, código o ID
        const subjectId = await this.findSubjectIdentifier(row.subject.toString());
        if (!subjectId) {
          result.errors.push(`Fila ${rowNumber}: Materia "${row.subject}" no encontrada`);
          continue;
        }

        // Obtener la materia para tener su carrera
        const subject = await this.subjectsService.findOne(subjectId);
        const careerId = subject.data?.careerId || subject.data?.career?._id;

        const groupData: any = {
          name: row.name.toString().trim(),
          subject: subjectId,
          career: careerId,
          active: row.active !== undefined ? Boolean(row.active) : true,
        };

        // Campos opcionales
        if (row.code) groupData.code = row.code.toString().trim();
        if (row.teacher) {
          const teacherId = await this.findUserIdentifier(row.teacher.toString());
          if (teacherId) {
            groupData.teacher = teacherId;
          } else {
            result.errors.push(`Fila ${rowNumber}: Profesor "${row.teacher}" no encontrado`);
          }
        }
        if (row.schedule) groupData.schedule = row.schedule.toString().trim();
        if (row.capacity) groupData.capacity = parseInt(row.capacity);

        // Crear el grupo
        const createdGroup = await this.groupsService.create(groupData);
        const groupId = createdGroup._id.toString();

        // Asignar estudiantes si se proporcionan
        if (row.students) {
          const studentIdentifiers = row.students.toString()
            .split(/[,;]/) // Separar por coma o punto y coma
            .map(id => id.trim())
            .filter(id => id.length > 0);

          const studentIds: string[] = [];
          
          for (const identifier of studentIdentifiers) {
            const studentId = await this.findUserIdentifier(identifier);
            if (studentId) {
              studentIds.push(studentId);
            } else {
              result.errors.push(`Fila ${rowNumber}: Estudiante "${identifier}" no encontrado`);
            }
          }

          if (studentIds.length > 0) {
            await this.groupsService.addStudents(groupId, studentIds);
          }
        }

        result.created++;

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** ========== MÉTODOS AUXILIARES ========== */

  /** Buscar carrera por nombre, código o ID */
  private async findCareerIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') return null;

    const cleanId = identifier.trim();

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const career = await this.careersService.findOne(cleanId);
        if (career?.success) return cleanId;
      } catch {}
    }

    // 2. Buscar por código
    try {
      const careers = await this.careersService.findAll();
      if (careers?.success && careers.data) {
        const career = careers.data.find((c: any) => 
          c.code?.toLowerCase() === cleanId.toLowerCase() ||
          c.name?.toLowerCase() === cleanId.toLowerCase()
        );
        if (career) return career._id;
      }
    } catch {}

    return null;
  }

  /** Buscar carrera por nombre o código */
  private async findCareerByNameOrCode(name: string, code: string): Promise<any> {
    try {
      const careers = await this.careersService.findAll();
      if (careers?.success && careers.data) {
        return careers.data.find((c: any) => 
          c.name?.toLowerCase() === name.toLowerCase() ||
          c.code?.toLowerCase() === code.toLowerCase()
        );
      }
    } catch {}
    return null;
  }

  /** Buscar materia por código */
  private async findSubjectByCode(code: string): Promise<any> {
    try {
      const subjects = await this.subjectsService.findAll();
      if (subjects?.success && subjects.data) {
        return subjects.data.find((s: any) => 
          s.code?.toLowerCase() === code.toLowerCase()
        );
      }
    } catch {}
    return null;
  }

  /** Buscar materia por nombre, código o ID */
  private async findSubjectIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') return null;

    const cleanId = identifier.trim();

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const subject = await this.subjectsService.findOne(cleanId);
        if (subject?.success) return cleanId;
      } catch {}
    }

    // 2. Buscar por código o nombre
    try {
      const subjects = await this.subjectsService.findAll();
      if (subjects?.success && subjects.data) {
        const subject = subjects.data.find((s: any) => 
          s.code?.toLowerCase() === cleanId.toLowerCase() ||
          s.name?.toLowerCase() === cleanId.toLowerCase()
        );
        if (subject) return subject._id;
      }
    } catch {}

    return null;
  }

  /** Buscar usuario por email, nombre o ID */
  private async findUserIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') return null;

    const cleanId = identifier.trim();

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const user = await this.usersService.findOne(cleanId);
        if (user) return cleanId;
      } catch {}
    }

    // 2. Buscar por email
    if (cleanId.includes('@')) {
      const user = await this.usersService.findByEmail(cleanId);
      if (user) return user._id.toString();
    }

    // 3. Buscar por nombre completo
    try {
      // Nota: Esto requeriría un método de búsqueda por nombre en UsersService
      // Por ahora, solo manejamos email e ID
    } catch {}

    return null;
  }

  /** Generar código de materia automáticamente */
  private generateSubjectCode(subjectName: string): string {
    // Tomar las primeras letras de cada palabra en mayúsculas
    const words = subjectName.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.map(w => w.charAt(0)).join('').toUpperCase().substring(0, 4);
    }
    return subjectName.substring(0, 4).toUpperCase();
  }
}