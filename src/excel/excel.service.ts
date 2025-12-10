// excel.service.ts - Versión corregida
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { UsersService } from '../users/users.service';
import { CareersService } from '../careers/careers.service';
import { SubjectsService } from '../subjects/subjects.service';
import { GroupsService } from '../groups/groups.service';
import { hashPassword } from '../common/utils';

interface SheetResult {
  created: number;
  updated: number;
  errors: string[];
}

interface ImportResult {
  summary: {
    totalSheets: number;
    processedSheets: number;
    errors: string[];
    success: boolean;
    message: string;
    totalCreated: number;
    totalUpdated: number;
  };
  details: Record<string, SheetResult>;
}

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly careersService: CareersService,
    private readonly subjectsService: SubjectsService,
    private readonly groupsService: GroupsService,
  ) {
    this.logger.log('✅ ExcelService inicializado correctamente');
  }

  /** Normalizar nombres de columnas */
  private normalizeColumnName(columnName: string): string {
    if (!columnName) return '';
    
    return columnName.toString().toLowerCase().trim()
      .replace(/\s+/g, '_')
      .replace(/[áäà]/g, 'a').replace(/[éëè]/g, 'e').replace(/[íïì]/g, 'i')
      .replace(/[óöò]/g, 'o').replace(/[úüù]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9_]/g, '');
  }

  /** Normalizar fila */
  private normalizeRow(row: any): any {
    const normalized: any = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[this.normalizeColumnName(key)] = value;
    }
    return normalized;
  }

  /** Obtener valor de fila con múltiples posibles nombres de columna */
  private getRowValue(row: any, possibleKeys: string[]): any {
    const normalizedRow = this.normalizeRow(row);
    
    for (const key of possibleKeys) {
      const normalizedKey = this.normalizeColumnName(key);
      if (normalizedRow[normalizedKey] !== undefined && 
          normalizedRow[normalizedKey] !== null && 
          normalizedRow[normalizedKey] !== '') {
        return normalizedRow[normalizedKey];
      }
    }
    return undefined;
  }

  /** Convertir valor booleano */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const str = value.toLowerCase().trim();
      return str === 'true' || str === '1' || str === 'si' || str === 'yes' || str === 'activo' || str === 'sí';
    }
    return true;
  }

  /** Validar email */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /** Generar código desde nombre */
  private generateCodeFromName(name: string): string {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.map(w => w.charAt(0)).join('').toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  }

  /** Generar código de materia */
  private generateSubjectCode(name: string): string {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.map(w => w.charAt(0)).join('').toUpperCase().substring(0, 4);
    }
    return name.substring(0, 4).toUpperCase();
  }

  /** Extraer ID de respuesta de servicio */
  private extractIdFromResponse(response: any): string | null {
    if (!response) return null;
    
    // Si es documento directo
    if (response._id) {
      return response._id.toString();
    }
    
    // Si es respuesta con formato {success, data}
    if (response.success && response.data) {
      if (response.data._id) {
        return response.data._id.toString();
      }
    }
    
    // Si es respuesta con formato {success, data: {data: {...}}}
    if (response.success && response.data && response.data.data && response.data.data._id) {
      return response.data.data._id.toString();
    }
    
    return null;
  }

  /** Extraer documento de respuesta de servicio */
  private extractDocumentFromResponse(response: any): any {
    if (!response) return null;
    
    // Si es documento directo
    if (response._id) {
      return response;
    }
    
    // Si es respuesta con formato {success, data}
    if (response.success && response.data) {
      return response.data;
    }
    
    // Si es respuesta con formato {success, data: {data: {...}}}
    if (response.success && response.data && response.data.data) {
      return response.data.data;
    }
    
    return null;
  }

  /** Método principal */
  async importExcel(file: Express.Multer.File): Promise<ImportResult> {
    this.logger.log('📥 ========== INICIO IMPORTACIÓN EXCEL ==========');
    
    if (!file) {
      throw new BadRequestException('Archivo Excel no proporcionado');
    }

    let fileBuffer: Buffer;
    if (file.buffer && file.buffer.length > 0) {
      fileBuffer = file.buffer;
    } else if (file.path) {
      const fs = await import('fs');
      if (fs.existsSync(file.path)) {
        fileBuffer = fs.readFileSync(file.path);
      } else {
        throw new BadRequestException('El archivo no existe');
      }
    } else {
      throw new BadRequestException('No se pudo obtener contenido del archivo');
    }

    // Leer Excel
    const workbook = XLSX.read(fileBuffer, { 
      type: 'buffer',
      cellDates: true,
      cellNF: false,
      cellText: false,
      raw: false
    });

    const result: ImportResult = {
      summary: {
        totalSheets: workbook.SheetNames.length,
        processedSheets: 0,
        errors: [] as string[],
        success: false,
        message: '',
        totalCreated: 0,
        totalUpdated: 0
      },
      details: {},
    };

    try {
      // Procesar en orden: carreras -> usuarios -> materias -> grupos
      const sheetsToProcess = [
        { name: 'carreras', aliases: ['careers'], handler: this.importCareers.bind(this) },
        { name: 'usuarios', aliases: ['users'], handler: this.importUsers.bind(this) },
        { name: 'materias', aliases: ['subjects'], handler: this.importSubjects.bind(this) },
        { name: 'grupos', aliases: ['groups'], handler: this.importGroups.bind(this) },
      ];

      for (const sheet of sheetsToProcess) {
        const sheetName = workbook.SheetNames.find(name => 
          [sheet.name, ...sheet.aliases].includes(name.toLowerCase().trim())
        );
        
        if (sheetName) {
          this.logger.log(`🔄 Procesando ${sheet.name} desde: "${sheetName}"`);
          const sheetData = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheetData);
          
          if (data.length > 0) {
            result.details[sheet.name] = await sheet.handler(data);
            result.summary.processedSheets++;
          } else {
            result.details[sheet.name] = { created: 0, updated: 0, errors: ['Hoja vacía'] };
          }
        } else {
          result.summary.errors.push(`No se encontró hoja de ${sheet.name}`);
          result.details[sheet.name] = { created: 0, updated: 0, errors: [`Hoja no encontrada`] };
        }
      }

      // Calcular totales
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalErrors = 0;

      for (const sheetResult of Object.values(result.details)) {
        totalCreated += sheetResult.created || 0;
        totalUpdated += sheetResult.updated || 0;
        totalErrors += sheetResult.errors?.length || 0;
      }

      totalErrors += result.summary.errors.length;

      result.summary.totalCreated = totalCreated;
      result.summary.totalUpdated = totalUpdated;
      result.summary.success = totalErrors === 0 && (totalCreated > 0 || totalUpdated > 0);
      
      if (result.summary.success) {
        result.summary.message = `✅ Importación exitosa. ${totalCreated} creados, ${totalUpdated} actualizados.`;
      } else if (totalCreated > 0 || totalUpdated > 0) {
        result.summary.message = `⚠️ Importación con advertencias. ${totalCreated} creados, ${totalUpdated} actualizados, ${totalErrors} errores.`;
      } else {
        result.summary.message = `❌ No se crearon registros. ${totalErrors} errores encontrados.`;
      }

      this.logger.log('📊 ========== RESUMEN IMPORTACIÓN ==========');
      this.logger.log(`📊 Total creados: ${totalCreated}, actualizados: ${totalUpdated}, errores: ${totalErrors}`);

      return result;

    } catch (error: any) {
      this.logger.error('❌ Error general en importación:', error.message);
      throw new BadRequestException(`Error en importación: ${error.message}`);
    }
  }

  /** Importar carreras */
  private async importCareers(data: any[]): Promise<SheetResult> {
    const result: SheetResult = { created: 0, updated: 0, errors: [] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const name = this.getRowValue(row, ['name', 'nombre', 'carrera']);
        const code = this.getRowValue(row, ['code', 'codigo', 'código']);
        const description = this.getRowValue(row, ['description', 'descripcion', 'descripción']);
        const duration = this.getRowValue(row, ['duration', 'duracion', 'duración']);
        const active = this.getRowValue(row, ['active', 'activo', 'estado']);

        if (!name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de carrera requerido`);
          continue;
        }

        const careerName = name.toString().trim();
        const careerCode = code ? code.toString().trim().toUpperCase() : 
                          this.generateCodeFromName(careerName);

        const careerData = {
          name: careerName,
          code: careerCode,
          description: description ? description.toString().trim() : '',
          duration: duration ? parseInt(duration.toString()) || 8 : 8,
          active: active !== undefined ? this.parseBoolean(active) : true,
        };

        // Buscar si ya existe
        const careerResponse = await this.careersService.findByNameOrCode(careerCode);
        const existingCareer = this.extractDocumentFromResponse(careerResponse);
        
        if (existingCareer && existingCareer._id) {
          // Actualizar
          await this.careersService.update(existingCareer._id.toString(), careerData);
          result.updated++;
          this.logger.log(`🔄 Carrera actualizada: ${careerName}`);
        } else {
          // Crear nueva
          await this.careersService.create(careerData);
          result.created++;
          this.logger.log(`✅ Carrera creada: ${careerName}`);
        }

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importar usuarios */
  private async importUsers(data: any[]): Promise<SheetResult> {
    const result: SheetResult = { created: 0, updated: 0, errors: [] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const email = this.getRowValue(row, ['email', 'correo']);
        const role = this.getRowValue(row, ['role', 'rol']);
        const fullName = this.getRowValue(row, ['fullname', 'nombre_completo', 'nombre', 'name']);
        const firstName = this.getRowValue(row, ['firstname', 'nombre', 'primer_nombre']);
        const lastName = this.getRowValue(row, ['lastname', 'apellido', 'apellidos']);
        const password = this.getRowValue(row, ['password', 'contrasena', 'contraseña']);
        const career = this.getRowValue(row, ['career', 'carrera']);
        const phone = this.getRowValue(row, ['phone', 'telefono', 'teléfono']);
        const active = this.getRowValue(row, ['active', 'activo', 'estado']);

        // Validaciones
        if (!email) {
          result.errors.push(`Fila ${rowNumber}: Email requerido`);
          continue;
        }

        if (!role) {
          result.errors.push(`Fila ${rowNumber}: Rol requerido`);
          continue;
        }

        const emailStr = email.toString().trim().toLowerCase();
        if (!this.isValidEmail(emailStr)) {
          result.errors.push(`Fila ${rowNumber}: Email inválido`);
          continue;
        }

        // Preparar datos
        const userData: any = {
          email: emailStr,
          role: role.toString().toUpperCase(),
          active: active !== undefined ? this.parseBoolean(active) : true,
        };

        // Nombre
        if (fullName) {
          userData.fullName = fullName.toString().trim();
        } else if (firstName && lastName) {
          userData.fullName = `${firstName} ${lastName}`.trim();
          userData.firstName = firstName.toString().trim();
          userData.lastName = lastName.toString().trim();
        } else if (firstName) {
          userData.fullName = firstName.toString().trim();
          userData.firstName = firstName.toString().trim();
        } else {
          const username = emailStr.split('@')[0];
          userData.fullName = username.charAt(0).toUpperCase() + username.slice(1);
        }

        // Contraseña - usar hashPassword
        if (password && password.toString().trim()) {
          userData.password = await hashPassword(password.toString().trim());
        } else {
          userData.password = await hashPassword(`${emailStr.split('@')[0]}123`);
        }

        // Campos opcionales
        if (phone) userData.phone = phone.toString().trim();
        
        // Buscar carrera si se especifica
        if (career && career.toString().trim()) {
          const careerResponse = await this.careersService.findByNameOrCode(career.toString());
          const careerDoc = this.extractDocumentFromResponse(careerResponse);
          
          if (careerDoc && careerDoc._id) {
            userData.career = careerDoc._id;
          } else {
            result.errors.push(`Fila ${rowNumber}: Carrera "${career}" no encontrada`);
          }
        }

        // Verificar si usuario ya existe
        const existingUser = await this.usersService.findByEmail(emailStr);
        
        if (existingUser && existingUser._id) {
          // Actualizar (mantener contraseña existente si no se proporciona)
          if (!password || !password.toString().trim()) {
            delete userData.password; // No actualizar contraseña
          }
          await this.usersService.update(existingUser._id.toString(), userData);
          result.updated++;
          this.logger.log(`🔄 Usuario actualizado: ${emailStr}`);
        } else {
          // Crear nuevo
          await this.usersService.create(userData);
          result.created++;
          this.logger.log(`✅ Usuario creado: ${emailStr}`);
        }

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importar materias */
  private async importSubjects(data: any[]): Promise<SheetResult> {
    const result: SheetResult = { created: 0, updated: 0, errors: [] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const name = this.getRowValue(row, ['name', 'nombre', 'materia']);
        const code = this.getRowValue(row, ['code', 'codigo', 'código']);
        const career = this.getRowValue(row, ['career', 'carrera']);
        const credits = this.getRowValue(row, ['credits', 'creditos', 'créditos']);
        const semester = this.getRowValue(row, ['semester', 'semestre']);

        if (!name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de materia requerido`);
          continue;
        }

        if (!career) {
          result.errors.push(`Fila ${rowNumber}: Carrera requerida para materia`);
          continue;
        }

        const subjectName = name.toString().trim();
        const subjectCode = code ? code.toString().trim().toUpperCase() : 
                          this.generateSubjectCode(subjectName);

        // Buscar carrera
        const careerResponse = await this.careersService.findByNameOrCode(career.toString());
        const careerDoc = this.extractDocumentFromResponse(careerResponse);
        
        if (!careerDoc || !careerDoc._id) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${career}" no encontrada`);
          continue;
        }

        const subjectData = {
          name: subjectName,
          code: subjectCode,
          career: careerDoc._id,
          credits: credits ? parseInt(credits.toString()) || 4 : 4,
          semester: semester ? parseInt(semester.toString()) || 1 : 1,
          active: true,
        };

        // Buscar si ya existe por código
        const subjectResponse = await this.subjectsService.findByCode(subjectCode);
        const existingSubject = this.extractDocumentFromResponse(subjectResponse);
        
        if (existingSubject && existingSubject._id) {
          // Actualizar
          await this.subjectsService.update(existingSubject._id.toString(), subjectData);
          result.updated++;
          this.logger.log(`🔄 Materia actualizada: ${subjectName}`);
        } else {
          // Crear nueva
          await this.subjectsService.create(subjectData);
          result.created++;
          this.logger.log(`✅ Materia creada: ${subjectName}`);
        }

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Importar grupos */
  private async importGroups(data: any[]): Promise<SheetResult> {
    const result: SheetResult = { created: 0, updated: 0, errors: [] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        const name = this.getRowValue(row, ['name', 'nombre', 'grupo']);
        const code = this.getRowValue(row, ['code', 'codigo', 'código']);
        const subject = this.getRowValue(row, ['subject', 'materia']);
        const teacher = this.getRowValue(row, ['teacher', 'profesor', 'docente']);
        const schedule = this.getRowValue(row, ['schedule', 'horario']);
        const capacity = this.getRowValue(row, ['capacity', 'capacidad']);
        const students = this.getRowValue(row, ['students', 'estudiantes', 'alumnos']);
        const active = this.getRowValue(row, ['active', 'activo', 'estado']);

        if (!name) {
          result.errors.push(`Fila ${rowNumber}: Nombre del grupo requerido`);
          continue;
        }

        if (!subject) {
          result.errors.push(`Fila ${rowNumber}: Materia requerida para grupo`);
          continue;
        }

        const groupName = name.toString().trim();
        const groupCode = code ? code.toString().trim() : 
                         `GRP-${this.generateCodeFromName(groupName)}`;

        // Buscar materia por código o nombre
        let subjectDoc = null;
        
        // Primero buscar por código
        const subjectByCodeResponse = await this.subjectsService.findByCode(subject.toString());
        subjectDoc = this.extractDocumentFromResponse(subjectByCodeResponse);
        
        // Si no encuentra por código, buscar por nombre
        if (!subjectDoc) {
          // Necesitaríamos un método para buscar por nombre
          // Por ahora, usar el código como nombre
          const allSubjectsResponse = await this.subjectsService.findAll();
          const allSubjects = this.extractDocumentFromResponse(allSubjectsResponse);
          
          if (Array.isArray(allSubjects)) {
            subjectDoc = allSubjects.find((s: any) => 
              s.name.toLowerCase() === subject.toString().toLowerCase() || 
              s.code.toLowerCase() === subject.toString().toLowerCase()
            );
          }
        }

        if (!subjectDoc || !subjectDoc._id) {
          result.errors.push(`Fila ${rowNumber}: Materia "${subject}" no encontrada`);
          continue;
        }

        // Preparar datos del grupo
        const groupData: any = {
          name: groupName,
          code: groupCode,
          subject: subjectDoc._id,
          schedule: schedule ? schedule.toString().trim() : '',
          capacity: capacity ? parseInt(capacity.toString()) || 30 : 30,
          active: active !== undefined ? this.parseBoolean(active) : true,
        };

        // Si la materia tiene carrera, asignarla al grupo
        if (subjectDoc.career && subjectDoc.career._id) {
          groupData.career = subjectDoc.career._id;
        } else if (subjectDoc.careerId) {
          groupData.career = subjectDoc.careerId;
        }

        // Buscar profesor por email
        if (teacher && teacher.toString().trim()) {
          const teacherUser = await this.usersService.findByEmail(teacher.toString());
          if (teacherUser && teacherUser._id) {
            groupData.teacher = teacherUser._id;
          } else {
            result.errors.push(`Fila ${rowNumber}: Profesor "${teacher}" no encontrado`);
          }
        }

        // Buscar si ya existe el grupo por código
        const groupResponse = await this.groupsService.findAll();
        let existingGroup = null;
        
        if (groupResponse) {
          // Los grupos no tienen método findByCode, buscar en la lista
          const allGroups = Array.isArray(groupResponse) ? groupResponse : [];
          existingGroup = allGroups.find((g: any) => 
            g.code && g.code.toLowerCase() === groupCode.toLowerCase()
          );
        }

        if (existingGroup && existingGroup._id) {
          // Actualizar grupo existente
          await this.groupsService.update(existingGroup._id.toString(), groupData);
          result.updated++;
          this.logger.log(`🔄 Grupo actualizado: ${groupName}`);
          
          // Asignar estudiantes si se especifican
          if (students && students.toString().trim()) {
            await this.assignStudents(existingGroup._id.toString(), students.toString(), rowNumber, result);
          }
        } else {
          // Crear nuevo grupo
          const createResponse = await this.groupsService.create(groupData);
          const newGroup = this.extractDocumentFromResponse(createResponse);
          
          if (newGroup && newGroup._id) {
            result.created++;
            this.logger.log(`✅ Grupo creado: ${groupName} (ID: ${newGroup._id})`);
            
            // Asignar estudiantes si se especifican
            if (students && students.toString().trim()) {
              await this.assignStudents(newGroup._id.toString(), students.toString(), rowNumber, result);
            }
          } else {
            result.errors.push(`Fila ${rowNumber}: Error al crear grupo "${groupName}"`);
          }
        }

      } catch (error: any) {
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    return result;
  }

  /** Asignar estudiantes a grupo */
  private async assignStudents(groupId: string, studentsString: string, rowNumber: number, result: SheetResult): Promise<void> {
    try {
      const studentEmails = studentsString
        .split(/[,;]/)
        .map(email => email.trim())
        .filter(email => this.isValidEmail(email));

      const studentIds: string[] = [];
      
      for (const email of studentEmails) {
        const student = await this.usersService.findByEmail(email);
        if (student && student._id) {
          studentIds.push(student._id.toString());
          this.logger.log(`👤 Estudiante encontrado: ${email} -> ${student._id}`);
        } else {
          result.errors.push(`Fila ${rowNumber}: Estudiante "${email}" no encontrado`);
        }
      }

      if (studentIds.length > 0) {
        try {
          await this.groupsService.addStudents(groupId, studentIds);
          this.logger.log(`✅ ${studentIds.length} estudiantes asignados al grupo ${groupId}`);
        } catch (error: any) {
          result.errors.push(`Fila ${rowNumber}: Error asignando estudiantes al grupo: ${error.message}`);
        }
      }

    } catch (error: any) {
      result.errors.push(`Fila ${rowNumber}: Error procesando estudiantes: ${error.message}`);
    }
  }

  /** Método de prueba */
  async testService(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🧪 Probando ExcelService...');
      
      const services = [
        { name: 'usersService', service: this.usersService },
        { name: 'careersService', service: this.careersService },
        { name: 'subjectsService', service: this.subjectsService },
        { name: 'groupsService', service: this.groupsService }
      ];
      
      const unavailableServices = services.filter(s => !s.service);
      
      if (unavailableServices.length > 0) {
        throw new Error(`Servicios no disponibles: ${unavailableServices.map(s => s.name).join(', ')}`);
      }
      
      return {
        success: true,
        message: 'ExcelService funcionando correctamente'
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}