import { Injectable, BadRequestException, Logger } from '@nestjs/common';
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

@Injectable()
export class ExcelService {
  private readonly logger = new Logger(ExcelService.name);

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
    this.logger.log('📥 ========== INICIO IMPORTACIÓN EXCEL ==========');
    this.logger.log('📥 Archivo recibido:', {
      originalname: file.originalname,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      mimetype: file.mimetype
    });

    if (!file) {
      throw new BadRequestException('Archivo Excel no proporcionado');
    }

    // Validar formato del archivo
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['xlsx', 'xls', 'csv'];
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      throw new BadRequestException(
        `Formato de archivo no soportado. Use: ${allowedExtensions.join(', ')}`,
      );
    }

    // Leer el archivo Excel
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(file.buffer, { 
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      this.logger.log(`📊 Libro Excel cargado: ${workbook.SheetNames.length} hojas`);
      this.logger.log(`📊 Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
    } catch (error: any) {
      this.logger.error('❌ Error leyendo archivo Excel:', error);
      throw new BadRequestException(`Error leyendo archivo Excel: ${error.message}`);
    }

    const result: Record<string, any> = {
      summary: {
        totalSheets: workbook.SheetNames.length,
        processedSheets: 0,
        errors: [] as string[],
        success: false,
        message: '',
        totalCreated: 0
      },
      details: {},
    };

    try {
      // IMPORTAR EN ORDEN: Carreras -> Usuarios -> Materias -> Grupos
      
      // 1. Primero procesar carreras (si existen)
      if (workbook.SheetNames.some(name => 
        ['carreras', 'careers'].includes(name.toLowerCase().trim())
      )) {
        const sheetName = workbook.SheetNames.find(name => 
          ['carreras', 'careers'].includes(name.toLowerCase().trim())
        );
        if (sheetName) {
          this.logger.log(`🔄 Procesando carreras desde hoja: "${sheetName}"`);
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          result.details['carreras'] = await this.importCareers(data);
          result.summary.processedSheets++;
        }
      }

      // 2. Luego usuarios
      if (workbook.SheetNames.some(name => 
        ['usuarios', 'users'].includes(name.toLowerCase().trim())
      )) {
        const sheetName = workbook.SheetNames.find(name => 
          ['usuarios', 'users'].includes(name.toLowerCase().trim())
        );
        if (sheetName) {
          this.logger.log(`🔄 Procesando usuarios desde hoja: "${sheetName}"`);
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          result.details['usuarios'] = await this.importUsers(data);
          result.summary.processedSheets++;
        }
      }

      // 3. Luego materias
      if (workbook.SheetNames.some(name => 
        ['materias', 'subjects', 'materia', 'subject'].includes(name.toLowerCase().trim())
      )) {
        const sheetName = workbook.SheetNames.find(name => 
          ['materias', 'subjects', 'materia', 'subject'].includes(name.toLowerCase().trim())
        );
        if (sheetName) {
          this.logger.log(`🔄 Procesando materias desde hoja: "${sheetName}"`);
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          result.details['materias'] = await this.importSubjects(data);
          result.summary.processedSheets++;
        }
      }

      // 4. Finalmente grupos
      if (workbook.SheetNames.some(name => 
        ['grupos', 'groups', 'grupo', 'group'].includes(name.toLowerCase().trim())
      )) {
        const sheetName = workbook.SheetNames.find(name => 
          ['grupos', 'groups', 'grupo', 'group'].includes(name.toLowerCase().trim())
        );
        if (sheetName) {
          this.logger.log(`🔄 Procesando grupos desde hoja: "${sheetName}"`);
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet);
          result.details['grupos'] = await this.importGroups(data);
          result.summary.processedSheets++;
        }
      }

      // Procesar otras hojas opcionales
      const processedSheets = ['carreras', 'usuarios', 'materias', 'grupos', 'careers', 'users', 'subjects', 'groups'];
      
      for (const sheetName of workbook.SheetNames) {
        const normalizedSheetName = sheetName.toLowerCase().trim();
        
        // Si no es una hoja ya procesada, mostrar advertencia
        if (!processedSheets.includes(normalizedSheetName)) {
          this.logger.warn(`⚠️ Hoja "${sheetName}" ignorada - no reconocida para importación`);
          result.summary.errors.push(`Hoja "${sheetName}" ignorada (no es requerida)`);
        }
      }

    } catch (error: any) {
      this.logger.error('❌ Error general en importación:', error);
      result.summary.errors.push(`Error general: ${error.message}`);
    }

    // Calcular totales
    const totalCreated = Object.values(result.details).reduce((sum: number, sheet: any) => 
      sum + (sheet.created || 0), 0);
    
    result.summary.totalCreated = totalCreated;
    result.summary.success = result.summary.errors.length === 0;
    
    if (result.summary.success) {
      result.summary.message = `✅ Importación completada exitosamente. ${totalCreated} registros creados.`;
    } else {
      result.summary.message = `⚠️ Importación completada con ${result.summary.errors.length} error(es). ${totalCreated} registros creados.`;
    }

    this.logger.log('📊 ========== RESUMEN IMPORTACIÓN ==========');
    this.logger.log(`📊 Hojas procesadas: ${result.summary.processedSheets}/${result.summary.totalSheets}`);
    this.logger.log(`📊 Registros creados: ${totalCreated}`);
    this.logger.log(`📊 Errores: ${result.summary.errors.length}`);
    
    for (const [sheetName, sheetResult] of Object.entries(result.details)) {
      this.logger.log(`📊 ${sheetName}: ${sheetResult.created} creados, ${sheetResult.errors?.length || 0} errores`);
    }
    
    if (result.summary.errors.length > 0) {
      this.logger.warn('⚠️ Errores encontrados:');
      result.summary.errors.forEach((error, index) => {
        this.logger.warn(`  ${index + 1}. ${error}`);
      });
    }
    
    this.logger.log('✅ ========== FIN IMPORTACIÓN EXCEL ==========');

    return result;
  }

  /** ========== IMPORTAR CARRERAS ========== */
  private async importCareers(data: any[]): Promise<{ created: number; errors: string[] }> {
    this.logger.log(`📥 Importando ${data.length} carreras`);
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // +2 porque Excel empieza en 1 y la fila 1 es encabezado

      try {
        // Validar datos requeridos
        if (!row.name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de carrera requerido`);
          continue;
        }

        const careerName = row.name.toString().trim();
        const careerCode = row.code ? row.code.toString().trim().toUpperCase() : 
                          this.generateCodeFromName(careerName);
        
        const careerData = {
          name: careerName,
          code: careerCode,
          description: row.description ? row.description.toString().trim() : '',
          duration: row.duration ? parseInt(row.duration) : 8,
        };

        this.logger.log(`📋 Procesando carrera [Fila ${rowNumber}]: ${careerName} (${careerCode})`);

        // Verificar si ya existe
        const existingCareer = await this.findCareerByNameOrCode(careerName, careerCode);
        if (existingCareer) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${careerName}" ya existe`);
          this.logger.log(`⚠️ Carrera ya existe: ${careerName}`);
          continue;
        }

        // Crear carrera
        this.logger.log(`🔄 Creando carrera: ${careerName}`);
        const createResult = await this.careersService.create(careerData);
        
        // Manejar diferentes estructuras de respuesta
        if (createResult && (createResult.success || createResult._id)) {
          result.created++;
          this.logger.log(`✅ Carrera creada: ${careerName} (${careerCode})`);
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear carrera "${careerName}"`);
          this.logger.error(`❌ Error creando carrera:`, createResult);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (carreras):`, error);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado carreras: ${result.created} creadas, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR USUARIOS ========== */
  private async importUsers(data: any[]): Promise<{ created: number; errors: string[] }> {
    this.logger.log(`📥 Importando ${data.length} usuarios`);
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        // Validar datos requeridos
        if (!row.email) {
          result.errors.push(`Fila ${rowNumber}: Email requerido`);
          continue;
        }

        if (!row.role) {
          result.errors.push(`Fila ${rowNumber}: Rol requerido`);
          continue;
        }

        const email = row.email.toString().trim().toLowerCase();
        const role = row.role.toString().toUpperCase();
        
        // Validar formato de email
        if (!this.isValidEmail(email)) {
          result.errors.push(`Fila ${rowNumber}: Email "${email}" no válido`);
          continue;
        }

        // Validar rol
        const validRoles = [
          'SUPERADMIN', 'ADMIN', 'DOCENTE', 'ESTUDIANTE', 
          'JEFE_ACADEMICO', 'TUTOR', 'PSICOPEDAGOGICO', 
          'DESARROLLO_ACADEMICO', 'CAPACITACION'
        ];
        
        if (!validRoles.includes(role)) {
          result.errors.push(`Fila ${rowNumber}: Rol "${role}" no válido. Roles válidos: ${validRoles.join(', ')}`);
          continue;
        }

        // Preparar datos del usuario
        const userData: any = {
          email: email,
          role: role,
          active: row.active !== undefined ? Boolean(row.active) : true,
        };

        // Manejar nombre
        if (row.fullName) {
          userData.fullName = row.fullName.toString().trim();
        } else if (row.firstName && row.lastName) {
          userData.fullName = `${row.firstName} ${row.lastName}`.trim();
          userData.firstName = row.firstName.toString().trim();
          userData.lastName = row.lastName.toString().trim();
        } else if (row.name) {
          userData.fullName = row.name.toString().trim();
        } else {
          // Si no hay nombre, usar parte del email
          const username = email.split('@')[0];
          userData.fullName = username.charAt(0).toUpperCase() + username.slice(1);
        }

        // Contraseña
        if (row.password) {
          userData.password = await hashPassword(row.password.toString());
        } else {
          // Contraseña por defecto
          userData.password = await hashPassword(`${email.split('@')[0]}123`);
        }

        // Campos opcionales
        if (row.phone) userData.phone = row.phone.toString().trim();
        
        // Buscar carrera si se especifica
        if (row.career) {
          const careerId = await this.findCareerIdentifier(row.career.toString());
          if (careerId) {
            userData.career = careerId;
            this.logger.log(`🔗 Usuario ${email} asignado a carrera: ${row.career} -> ${careerId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada para usuario ${email}`);
            this.logger.warn(`⚠️ Carrera no encontrada para usuario: ${row.career}`);
          }
        }

        // Verificar si usuario ya existe
        const existingUser = await this.usersService.findByEmail(email);
        if (existingUser) {
          result.errors.push(`Fila ${rowNumber}: Email ${email} ya existe`);
          this.logger.log(`⚠️ Usuario ya existe: ${email}`);
          continue;
        }

        this.logger.log(`📋 Procesando usuario [Fila ${rowNumber}]: ${email} (${role})`);

        // Crear usuario
        this.logger.log(`🔄 Creando usuario: ${email}`);
        const createdUser = await this.usersService.create(userData);
        
        if (createdUser && (createdUser.success || createdUser._id)) {
          result.created++;
          this.logger.log(`✅ Usuario creado: ${email} (${userData.fullName})`);
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear usuario ${email}`);
          this.logger.error(`❌ Error creando usuario:`, createdUser);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (usuarios):`, error);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado usuarios: ${result.created} creados, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR MATERIAS ========== */
  private async importSubjects(data: any[]): Promise<{ created: number; errors: string[] }> {
    this.logger.log(`📥 Importando ${data.length} materias`);
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        // Validar datos requeridos
        if (!row.name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de materia requerido`);
          continue;
        }

        if (!row.career) {
          result.errors.push(`Fila ${rowNumber}: Carrera requerida para materia`);
          continue;
        }

        const subjectName = row.name.toString().trim();
        const subjectCode = row.code ? row.code.toString().trim().toUpperCase() : 
                          this.generateSubjectCode(subjectName);
        
        // Buscar carrera
        const careerId = await this.findCareerIdentifier(row.career.toString());
        if (!careerId) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada para materia "${subjectName}"`);
          continue;
        }

        const subjectData = {
          name: subjectName,
          code: subjectCode,
          career: careerId,
          credits: row.credits ? parseInt(row.credits) : 4,
          semester: row.semester ? parseInt(row.semester) : 1,
        };

        this.logger.log(`📋 Procesando materia [Fila ${rowNumber}]: ${subjectName} (${subjectCode})`);

        // Verificar si ya existe el código
        const existingSubject = await this.findSubjectByCode(subjectCode);
        if (existingSubject) {
          result.errors.push(`Fila ${rowNumber}: Código de materia "${subjectCode}" ya existe`);
          this.logger.log(`⚠️ Código de materia ya existe: ${subjectCode}`);
          continue;
        }

        // Crear materia
        this.logger.log(`🔄 Creando materia: ${subjectName}`);
        const createResult = await this.subjectsService.create(subjectData);
        
        if (createResult && (createResult.success || createResult._id)) {
          result.created++;
          this.logger.log(`✅ Materia creada: ${subjectName} (${subjectCode})`);
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear materia "${subjectName}"`);
          this.logger.error(`❌ Error creando materia:`, createResult);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (materias):`, error);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado materias: ${result.created} creadas, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR GRUPOS ========== */
  private async importGroups(data: any[]): Promise<{ created: number; errors: string[] }> {
    this.logger.log(`📥 Importando ${data.length} grupos`);
    const result = { created: 0, errors: [] as string[] };
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        // Validar datos requeridos
        if (!row.name) {
          result.errors.push(`Fila ${rowNumber}: Nombre del grupo requerido`);
          continue;
        }

        if (!row.subject) {
          result.errors.push(`Fila ${rowNumber}: Materia requerida para grupo`);
          continue;
        }

        const groupName = row.name.toString().trim();
        const groupCode = row.code ? row.code.toString().trim() : 
                         `GRP-${this.generateCodeFromName(groupName)}`;

        // Buscar materia
        const subjectId = await this.findSubjectIdentifier(row.subject.toString());
        if (!subjectId) {
          result.errors.push(`Fila ${rowNumber}: Materia "${row.subject}" no encontrada para grupo "${groupName}"`);
          continue;
        }

        // Obtener la materia para obtener su carrera
        const subjectResult = await this.subjectsService.findOne(subjectId);
        let careerId: string | undefined;
        
        if (subjectResult && subjectResult.success && subjectResult.data) {
          const subjectData = subjectResult.data;
          careerId = subjectData.careerId || subjectData.career?._id || subjectData.career;
        } else if (subjectResult && subjectResult._id) {
          // Si la respuesta es el objeto directo
          careerId = (subjectResult as any).careerId || (subjectResult as any).career?._id;
        }

        // Preparar datos del grupo
        const groupData: any = {
          name: groupName,
          code: groupCode,
          subject: subjectId,
          schedule: row.schedule ? row.schedule.toString().trim() : '',
          capacity: row.capacity ? parseInt(row.capacity) : 30,
          active: row.active !== undefined ? Boolean(row.active) : true,
        };

        // Agregar carrera si se encontró
        if (careerId) {
          groupData.career = careerId;
        }

        // Buscar profesor si se especifica
        if (row.teacher) {
          const teacherId = await this.findUserIdentifier(row.teacher.toString());
          if (teacherId) {
            groupData.teacher = teacherId;
            this.logger.log(`👨‍🏫 Profesor asignado al grupo ${groupName}: ${row.teacher}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Profesor "${row.teacher}" no encontrado para grupo "${groupName}"`);
            this.logger.warn(`⚠️ Profesor no encontrado: ${row.teacher}`);
          }
        }

        this.logger.log(`📋 Procesando grupo [Fila ${rowNumber}]: ${groupName} (${groupCode})`);

        // Crear grupo
        this.logger.log(`🔄 Creando grupo: ${groupName}`);
        const createResult = await this.groupsService.create(groupData);
        
        let groupId: string | undefined;
        
        // Extraer ID del grupo creado de diferentes estructuras de respuesta
        if (createResult) {
          if (createResult._id) {
            groupId = createResult._id.toString();
          } else if (createResult.success && createResult.data && createResult.data._id) {
            groupId = createResult.data._id.toString();
          } else if (createResult.data && createResult.data._id) {
            groupId = createResult.data._id.toString();
          }
        }

        if (groupId) {
          result.created++;
          this.logger.log(`✅ Grupo creado: ${groupName} (ID: ${groupId})`);

          // Asignar estudiantes si se especifican
          if (row.students) {
            await this.assignStudentsToGroup(groupId, row.students.toString(), rowNumber, result);
          }
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear grupo "${groupName}" - No se obtuvo ID`);
          this.logger.error(`❌ Error creando grupo - no se obtuvo ID:`, createResult);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (grupos):`, error);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado grupos: ${result.created} creados, ${result.errors.length} errores`);
    return result;
  }

  /** ========== MÉTODOS AUXILIARES ========== */

  /** Asignar estudiantes a un grupo */
  private async assignStudentsToGroup(
    groupId: string, 
    studentsString: string, 
    rowNumber: number,
    result: { created: number; errors: string[] }
  ): Promise<void> {
    try {
      // Separar emails por coma o punto y coma
      const studentEmails = studentsString
        .split(/[,;]/)
        .map(email => email.trim())
        .filter(email => email.length > 0 && this.isValidEmail(email));

      if (studentEmails.length === 0) {
        this.logger.log(`ℹ️ No hay estudiantes válidos para asignar al grupo ${groupId}`);
        return;
      }

      this.logger.log(`👥 Asignando ${studentEmails.length} estudiantes al grupo ${groupId}`);

      const studentIds: string[] = [];
      
      for (const email of studentEmails) {
        const studentId = await this.findUserIdentifier(email);
        if (studentId) {
          studentIds.push(studentId);
          this.logger.log(`✅ Estudiante encontrado: ${email} -> ${studentId}`);
        } else {
          result.errors.push(`Fila ${rowNumber}: Estudiante "${email}" no encontrado para asignar al grupo`);
          this.logger.warn(`⚠️ Estudiante no encontrado: ${email}`);
        }
      }

      if (studentIds.length > 0) {
        // Asignar estudiantes al grupo
        try {
          await this.groupsService.addStudents(groupId, studentIds);
          this.logger.log(`✅ ${studentIds.length} estudiantes asignados al grupo ${groupId}`);
        } catch (error: any) {
          this.logger.error(`❌ Error asignando estudiantes al grupo ${groupId}:`, error);
          result.errors.push(`Fila ${rowNumber}: Error asignando estudiantes al grupo: ${error.message}`);
        }
      }

    } catch (error: any) {
      this.logger.error(`❌ Error procesando estudiantes para grupo ${groupId}:`, error);
    }
  }

  /** Buscar carrera por nombre, código o ID */
  private async findCareerIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') {
      return null;
    }

    const cleanId = identifier.trim();
    this.logger.log(`🔍 Buscando carrera con identificador: "${cleanId}"`);

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const careerResult = await this.careersService.findOne(cleanId);
        
        // Manejar diferentes estructuras de respuesta
        if (careerResult) {
          if (careerResult.success && careerResult.data && careerResult.data._id) {
            return careerResult.data._id.toString();
          }
          if (careerResult._id) {
            return careerResult._id.toString();
          }
          if (careerResult.data && (careerResult.data as any)._id) {
            return (careerResult.data as any)._id.toString();
          }
        }
      } catch (error) {
        this.logger.error(`❌ Error buscando carrera por ID ${cleanId}:`, error);
      }
    }

    // 2. Buscar por código o nombre
    try {
      const careersResult = await this.careersService.findAll();
      let careersArray: any[] = [];

      // Extraer array de diferentes estructuras
      if (careersResult) {
        if (careersResult.success && careersResult.data) {
          if (Array.isArray(careersResult.data)) {
            careersArray = careersResult.data;
          } else if (careersResult.data.data && Array.isArray(careersResult.data.data)) {
            careersArray = careersResult.data.data;
          } else if ((careersResult.data as any).data && Array.isArray((careersResult.data as any).data)) {
            careersArray = (careersResult.data as any).data;
          }
        } else if (Array.isArray(careersResult)) {
          careersArray = careersResult;
        } else if (careersResult.data && Array.isArray(careersResult.data)) {
          careersArray = careersResult.data;
        }
      }

      // Buscar coincidencia
      const found = careersArray.find((c: any) => {
        if (!c) return false;
        const nameMatch = c.name?.toLowerCase() === cleanId.toLowerCase();
        const codeMatch = c.code?.toLowerCase() === cleanId.toLowerCase();
        return nameMatch || codeMatch;
      });

      if (found) {
        this.logger.log(`✅ Carrera encontrada: "${cleanId}" -> ${found._id} (${found.name})`);
        return found._id?.toString();
      }

    } catch (error) {
      this.logger.error('❌ Error buscando carrera por nombre/código:', error);
    }

    this.logger.log(`❌ Carrera no encontrada: "${cleanId}"`);
    return null;
  }

  /** Buscar carrera por nombre o código */
  private async findCareerByNameOrCode(name: string, code: string): Promise<any> {
    try {
      const careersResult = await this.careersService.findAll();
      let careersArray: any[] = [];

      if (careersResult) {
        if (careersResult.success && careersResult.data) {
          if (Array.isArray(careersResult.data)) {
            careersArray = careersResult.data;
          } else if (careersResult.data.data && Array.isArray(careersResult.data.data)) {
            careersArray = careersResult.data.data;
          }
        } else if (Array.isArray(careersResult)) {
          careersArray = careersResult;
        }
      }

      return careersArray.find((c: any) => {
        if (!c) return false;
        const nameMatch = c.name?.toLowerCase() === name.toLowerCase();
        const codeMatch = c.code?.toLowerCase() === code.toLowerCase();
        return nameMatch || codeMatch;
      });
    } catch (error) {
      this.logger.error('❌ Error en findCareerByNameOrCode:', error);
      return null;
    }
  }

  /** Buscar materia por código */
  private async findSubjectByCode(code: string): Promise<any> {
    try {
      const subjectsResult = await this.subjectsService.findAll();
      let subjectsArray: any[] = [];

      if (subjectsResult) {
        if (subjectsResult.success && subjectsResult.data) {
          if (Array.isArray(subjectsResult.data)) {
            subjectsArray = subjectsResult.data;
          } else if (subjectsResult.data.data && Array.isArray(subjectsResult.data.data)) {
            subjectsArray = subjectsResult.data.data;
          }
        } else if (Array.isArray(subjectsResult)) {
          subjectsArray = subjectsResult;
        }
      }

      return subjectsArray.find((s: any) => 
        s && s.code?.toLowerCase() === code.toLowerCase()
      );
    } catch (error) {
      this.logger.error('❌ Error en findSubjectByCode:', error);
      return null;
    }
  }

  /** Buscar materia por nombre, código o ID */
  private async findSubjectIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') {
      return null;
    }

    const cleanId = identifier.trim();
    this.logger.log(`🔍 Buscando materia con identificador: "${cleanId}"`);

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const subjectResult = await this.subjectsService.findOne(cleanId);
        
        if (subjectResult) {
          if (subjectResult.success && subjectResult.data && subjectResult.data._id) {
            return subjectResult.data._id.toString();
          }
          if (subjectResult._id) {
            return subjectResult._id.toString();
          }
        }
      } catch (error) {
        this.logger.error(`❌ Error buscando materia por ID ${cleanId}:`, error);
      }
    }

    // 2. Buscar por código o nombre
    try {
      const subjectsResult = await this.subjectsService.findAll();
      let subjectsArray: any[] = [];

      if (subjectsResult) {
        if (subjectsResult.success && subjectsResult.data) {
          if (Array.isArray(subjectsResult.data)) {
            subjectsArray = subjectsResult.data;
          } else if (subjectsResult.data.data && Array.isArray(subjectsResult.data.data)) {
            subjectsArray = subjectsResult.data.data;
          }
        } else if (Array.isArray(subjectsResult)) {
          subjectsArray = subjectsResult;
        }
      }

      const found = subjectsArray.find((s: any) => {
        if (!s) return false;
        const nameMatch = s.name?.toLowerCase() === cleanId.toLowerCase();
        const codeMatch = s.code?.toLowerCase() === cleanId.toLowerCase();
        return nameMatch || codeMatch;
      });

      if (found) {
        this.logger.log(`✅ Materia encontrada: "${cleanId}" -> ${found._id} (${found.name})`);
        return found._id?.toString();
      }

    } catch (error) {
      this.logger.error('❌ Error buscando materia por nombre/código:', error);
    }

    this.logger.log(`❌ Materia no encontrada: "${cleanId}"`);
    return null;
  }

  /** Buscar usuario por email, nombre o ID */
  private async findUserIdentifier(identifier: string): Promise<string | null> {
    if (!identifier || identifier.trim() === '') {
      return null;
    }

    const cleanId = identifier.trim();

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const user = await this.usersService.findOne(cleanId);
        if (user && (user as any)._id) {
          return (user as any)._id.toString();
        }
      } catch (error) {
        this.logger.error(`❌ Error buscando usuario por ID ${cleanId}:`, error);
      }
    }

    // 2. Buscar por email (caso más común)
    if (cleanId.includes('@')) {
      try {
        const user = await this.usersService.findByEmail(cleanId);
        if (user && (user as any)._id) {
          this.logger.log(`✅ Usuario encontrado por email: ${cleanId} -> ${(user as any)._id}`);
          return (user as any)._id.toString();
        }
      } catch (error) {
        this.logger.error(`❌ Error buscando usuario por email ${cleanId}:`, error);
      }
    }

    this.logger.log(`❌ Usuario no encontrado: "${cleanId}"`);
    return null;
  }

  /** Generar código de materia automáticamente */
  private generateSubjectCode(subjectName: string): string {
    const words = subjectName.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.map(w => w.charAt(0)).join('').toUpperCase().substring(0, 4);
    }
    return subjectName.substring(0, 4).toUpperCase();
  }

  /** Generar código automáticamente desde nombre */
  private generateCodeFromName(name: string): string {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return words.map(w => w.charAt(0)).join('').toUpperCase();
    }
    return name.substring(0, 3).toUpperCase();
  }

  /** Validar formato de email */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}