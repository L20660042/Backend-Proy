import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
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

// Definir tipos para los resultados
interface SheetResult {
  created: number;
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
    private readonly tutoriaService: TutoriaService,
    private readonly capacitacionService: CapacitacionService,
    private readonly alertsService: AlertsService,
  ) {
    this.logger.log('✅ ExcelService inicializado correctamente');
    this.logger.log('📊 Servicios inyectados:');
    this.logger.log(`  - UsersService: ${!!usersService}`);
    this.logger.log(`  - CareersService: ${!!careersService}`);
    this.logger.log(`  - SubjectsService: ${!!subjectsService}`);
    this.logger.log(`  - GroupsService: ${!!groupsService}`);
    this.logger.log(`  - TutoriaService: ${!!tutoriaService}`);
    this.logger.log(`  - CapacitacionService: ${!!capacitacionService}`);
    this.logger.log(`  - AlertsService: ${!!alertsService}`);
  }

  async importExcel(file: Express.Multer.File): Promise<ImportResult> {
    this.logger.log('📥 ========== INICIO IMPORTACIÓN EXCEL ==========');
    this.logger.log('📥 Archivo recibido en servicio:', {
      originalname: file?.originalname,
      size: file?.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A',
      mimetype: file?.mimetype,
      bufferLength: file?.buffer?.length || 0,
      path: file?.path || 'N/A'
    });

    if (!file) {
      this.logger.error('❌ Archivo no proporcionado');
      throw new BadRequestException('Archivo Excel no proporcionado');
    }

    // Validar que tenemos buffer o path
    if ((!file.buffer || file.buffer.length === 0) && !file.path) {
      this.logger.error('❌ Archivo sin contenido (sin buffer ni path)');
      throw new BadRequestException('El archivo está vacío o no se pudo leer');
    }

    let fileBuffer: Buffer;
    
    // Si tenemos buffer, usarlo
    if (file.buffer && file.buffer.length > 0) {
      fileBuffer = file.buffer;
      this.logger.log(`✅ Usando buffer existente: ${fileBuffer.length} bytes`);
    } 
    // Si no hay buffer pero hay path, leer del disco
    else if (file.path) {
      try {
        const fs = await import('fs');
        if (fs.existsSync(file.path)) {
          fileBuffer = fs.readFileSync(file.path);
          this.logger.log(`✅ Archivo leído del disco: ${fileBuffer.length} bytes`);
        } else {
          throw new BadRequestException('El archivo no existe en la ruta especificada');
        }
      } catch (error) {
        this.logger.error('❌ Error leyendo archivo del disco:', error);
        throw new BadRequestException(`Error leyendo archivo: ${error.message}`);
      }
    } else {
      throw new BadRequestException('No se pudo obtener contenido del archivo');
    }

    // Validar formato del archivo
    const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['xlsx', 'xls', 'csv'];
    
    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
      this.logger.error(`❌ Formato no permitido: ${fileExtension}`);
      throw new BadRequestException(
        `Formato de archivo no soportado. Formatos permitidos: ${allowedExtensions.join(', ')}`,
      );
    }

    // Leer el archivo Excel
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false,
        raw: false
      });
      this.logger.log(`📊 Libro Excel cargado: ${workbook.SheetNames.length} hojas`);
      this.logger.log(`📊 Hojas disponibles: ${workbook.SheetNames.join(', ')}`);
    } catch (error: any) {
      this.logger.error('❌ Error leyendo archivo Excel:', error.message);
      throw new BadRequestException(`Error leyendo archivo Excel: ${error.message}`);
    }

    const result: ImportResult = {
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
      const carrerasSheetName = workbook.SheetNames.find(name => 
        ['carreras', 'careers'].includes(name.toLowerCase().trim())
      );
      
      if (carrerasSheetName) {
        this.logger.log(`🔄 Procesando carreras desde hoja: "${carrerasSheetName}"`);
        const sheet = workbook.Sheets[carrerasSheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        this.logger.log(`📊 Encontradas ${data.length} filas en carreras`);
        
        if (data.length > 0) {
          result.details['carreras'] = await this.importCareers(data);
          result.summary.processedSheets++;
        } else {
          this.logger.warn('⚠️ Hoja de carreras está vacía');
          result.details['carreras'] = { created: 0, errors: ['Hoja vacía'] };
        }
      } else {
        this.logger.warn('⚠️ No se encontró hoja de carreras.');
        result.summary.errors.push('No se encontró hoja de carreras');
      }

      // 2. Luego usuarios
      const usuariosSheetName = workbook.SheetNames.find(name => 
        ['usuarios', 'users'].includes(name.toLowerCase().trim())
      );
      
      if (usuariosSheetName) {
        this.logger.log(`🔄 Procesando usuarios desde hoja: "${usuariosSheetName}"`);
        const sheet = workbook.Sheets[usuariosSheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        this.logger.log(`📊 Encontradas ${data.length} filas en usuarios`);
        
        if (data.length > 0) {
          result.details['usuarios'] = await this.importUsers(data);
          result.summary.processedSheets++;
        } else {
          this.logger.warn('⚠️ Hoja de usuarios está vacía');
          result.details['usuarios'] = { created: 0, errors: ['Hoja vacía'] };
        }
      } else {
        this.logger.warn('⚠️ No se encontró hoja de usuarios.');
        result.summary.errors.push('No se encontró hoja de usuarios');
      }

      // 3. Luego materias
      const materiasSheetName = workbook.SheetNames.find(name => 
        ['materias', 'subjects', 'materia', 'subject'].includes(name.toLowerCase().trim())
      );
      
      if (materiasSheetName) {
        this.logger.log(`🔄 Procesando materias desde hoja: "${materiasSheetName}"`);
        const sheet = workbook.Sheets[materiasSheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        this.logger.log(`📊 Encontradas ${data.length} filas en materias`);
        
        if (data.length > 0) {
          result.details['materias'] = await this.importSubjects(data);
          result.summary.processedSheets++;
        } else {
          this.logger.warn('⚠️ Hoja de materias está vacía');
          result.details['materias'] = { created: 0, errors: ['Hoja vacía'] };
        }
      } else {
        this.logger.warn('⚠️ No se encontró hoja de materias.');
        result.summary.errors.push('No se encontró hoja de materias');
      }

      // 4. Finalmente grupos
      const gruposSheetName = workbook.SheetNames.find(name => 
        ['grupos', 'groups', 'grupo', 'group'].includes(name.toLowerCase().trim())
      );
      
      if (gruposSheetName) {
        this.logger.log(`🔄 Procesando grupos desde hoja: "${gruposSheetName}"`);
        const sheet = workbook.Sheets[gruposSheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        this.logger.log(`📊 Encontradas ${data.length} filas en grupos`);
        
        if (data.length > 0) {
          result.details['grupos'] = await this.importGroups(data);
          result.summary.processedSheets++;
        } else {
          this.logger.warn('⚠️ Hoja de grupos está vacía');
          result.details['grupos'] = { created: 0, errors: ['Hoja vacía'] };
        }
      } else {
        this.logger.warn('⚠️ No se encontró hoja de grupos.');
        result.summary.errors.push('No se encontró hoja de grupos');
      }

      // Procesar otras hojas opcionales
      const processedSheets = ['carreras', 'usuarios', 'materias', 'grupos', 'careers', 'users', 'subjects', 'groups'];
      
      for (const sheetName of workbook.SheetNames) {
        const normalizedSheetName = sheetName.toLowerCase().trim();
        
        // Si no es una hoja ya procesada, mostrar advertencia
        if (!processedSheets.includes(normalizedSheetName)) {
          this.logger.warn(`⚠️ Hoja "${sheetName}" ignorada - no reconocida para importación`);
        }
      }

    } catch (error: any) {
      this.logger.error('❌ Error general en importación:', error.message);
      this.logger.error(error.stack);
      result.summary.errors.push(`Error general: ${error.message}`);
    }

    // Calcular totales
    const totalCreated = Object.values(result.details).reduce((sum: number, sheet: SheetResult) => 
      sum + (sheet.created || 0), 0);
    
    const totalErrors = Object.values(result.details).reduce((sum: number, sheet: SheetResult) => 
      sum + (sheet.errors?.length || 0), 0) + result.summary.errors.length;
    
    result.summary.totalCreated = totalCreated;
    result.summary.success = totalErrors === 0 && totalCreated > 0;
    
    if (result.summary.success) {
      result.summary.message = `✅ Importación completada exitosamente. ${totalCreated} registros creados.`;
    } else if (totalCreated > 0) {
      result.summary.message = `⚠️ Importación completada con advertencias. ${totalCreated} registros creados, ${totalErrors} errores.`;
    } else {
      result.summary.message = `❌ No se crearon registros. ${totalErrors} errores encontrados.`;
    }

    this.logger.log('📊 ========== RESUMEN IMPORTACIÓN ==========');
    this.logger.log(`📊 Hojas procesadas: ${result.summary.processedSheets}/${result.summary.totalSheets}`);
    this.logger.log(`📊 Registros creados: ${totalCreated}`);
    this.logger.log(`📊 Errores totales: ${totalErrors}`);
    
    for (const [sheetName, sheetResult] of Object.entries(result.details)) {
      this.logger.log(`📊 ${sheetName}: ${sheetResult.created} creados, ${sheetResult.errors?.length || 0} errores`);
      if (sheetResult.errors && sheetResult.errors.length > 0) {
        sheetResult.errors.forEach((error, idx) => {
          this.logger.log(`    ${idx + 1}. ${error}`);
        });
      }
    }
    
    if (result.summary.errors.length > 0) {
      this.logger.log('📊 Errores generales:');
      result.summary.errors.forEach((error, idx) => {
        this.logger.log(`    ${idx + 1}. ${error}`);
      });
    }
    
    this.logger.log('✅ ========== FIN IMPORTACIÓN EXCEL ==========');

    return result;
  }

  /** ========== IMPORTAR CARRERAS ========== */
  private async importCareers(data: any[]): Promise<SheetResult> {
    this.logger.log(`📥 Importando ${data.length} carreras`);
    const result: SheetResult = { created: 0, errors: [] };
    
    if (data.length === 0) {
      result.errors.push('No hay datos para procesar');
      return result;
    }
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2;

      try {
        // Validar datos requeridos
        if (!row.name) {
          result.errors.push(`Fila ${rowNumber}: Nombre de carrera requerido`);
          continue;
        }

        const careerName = row.name.toString().trim();
        const careerCode = row.code ? row.code.toString().trim().toUpperCase() : 
                          this.generateCodeFromName(careerName);
        
        if (!careerName || careerName.length === 0) {
          result.errors.push(`Fila ${rowNumber}: Nombre de carrera vacío`);
          continue;
        }

        const careerData = {
          name: careerName,
          code: careerCode,
          description: row.description ? row.description.toString().trim() : '',
          duration: row.duration ? parseInt(row.duration.toString()) || 8 : 8,
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
        
        if (createResult) {
          // Verificar diferentes estructuras de respuesta
          const resultObj = createResult as any;
          
          // Intentar extraer el ID de diferentes formas
          let careerId: string | null = null;
          
          if (resultObj._id) {
            careerId = resultObj._id.toString();
          } else if (resultObj.success && resultObj.data) {
            if (resultObj.data._id) {
              careerId = resultObj.data._id.toString();
            } else if (resultObj.data.data && resultObj.data.data._id) {
              careerId = resultObj.data.data._id.toString();
            }
          } else if (resultObj.data && resultObj.data._id) {
            careerId = resultObj.data._id.toString();
          }
          
          if (careerId) {
            result.created++;
            this.logger.log(`✅ Carrera creada: ${careerName} (${careerCode}) - ID: ${careerId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Error al crear carrera "${careerName}" - Respuesta inválida`);
            this.logger.error(`❌ Respuesta inválida para carrera:`, createResult);
          }
        } else {
          result.errors.push(`Fila ${rowNumber}: No se recibió respuesta al crear carrera "${careerName}"`);
          this.logger.error(`❌ Respuesta vacía para carrera: ${careerName}`);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (carreras):`, error.message);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado carreras: ${result.created} creadas, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR USUARIOS ========== */
  private async importUsers(data: any[]): Promise<SheetResult> {
    this.logger.log(`📥 Importando ${data.length} usuarios`);
    const result: SheetResult = { created: 0, errors: [] };
    
    if (data.length === 0) {
      result.errors.push('No hay datos para procesar');
      return result;
    }
    
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
          userData.firstName = username.charAt(0).toUpperCase() + username.slice(1);
        }

        // Contraseña
        if (row.password && row.password.toString().trim()) {
          userData.password = await hashPassword(row.password.toString());
        } else {
          // Contraseña por defecto
          const defaultPassword = `${email.split('@')[0]}123`;
          userData.password = await hashPassword(defaultPassword);
          this.logger.log(`🔑 Contraseña por defecto para ${email}: ${defaultPassword}`);
        }

        // Campos opcionales
        if (row.phone) userData.phone = row.phone.toString().trim();
        
        // Buscar carrera si se especifica
        if (row.career && row.career.toString().trim()) {
          const careerId = await this.findCareerIdentifier(row.career.toString());
          if (careerId) {
            userData.career = careerId;
            this.logger.log(`🔗 Usuario ${email} asignado a carrera: ${row.career} -> ${careerId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada para usuario ${email}`);
            this.logger.warn(`⚠️ Carrera no encontrada: "${row.career}" para usuario ${email}`);
          }
        }

        // Verificar si usuario ya existe
        try {
          const existingUser = await this.usersService.findByEmail(email);
          if (existingUser) {
            result.errors.push(`Fila ${rowNumber}: Email ${email} ya existe`);
            this.logger.log(`⚠️ Usuario ya existe: ${email}`);
            continue;
          }
        } catch (error) {
          // Si hay error al buscar, continuar (puede que el usuario no exista)
          this.logger.log(`🔍 Usuario ${email} no encontrado, procediendo a crear`);
        }

        this.logger.log(`📋 Procesando usuario [Fila ${rowNumber}]: ${email} (${role})`);

        // Crear usuario
        this.logger.log(`🔄 Creando usuario: ${email}`);
        const createdUser = await this.usersService.create(userData);
        
        if (createdUser) {
          // Verificar diferentes estructuras de respuesta
          const userObj = createdUser as any;
          let userId: string | null = null;
          
          if (userObj._id) {
            userId = userObj._id.toString();
          } else if (userObj.success && userObj.data) {
            if (userObj.data._id) {
              userId = userObj.data._id.toString();
            } else if (userObj.data.data && userObj.data.data._id) {
              userId = userObj.data.data._id.toString();
            }
          } else if (userObj.data && userObj.data._id) {
            userId = userObj.data._id.toString();
          }
          
          if (userId) {
            result.created++;
            this.logger.log(`✅ Usuario creado: ${email} (${userData.fullName}) - ID: ${userId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Error al crear usuario ${email} - Respuesta inválida`);
            this.logger.error(`❌ Respuesta inválida para usuario:`, createdUser);
          }
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear usuario ${email} - Respuesta vacía`);
          this.logger.error(`❌ Respuesta vacía para usuario: ${email}`);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (usuarios):`, error.message);
        this.logger.error(error.stack);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado usuarios: ${result.created} creados, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR MATERIAS ========== */
  private async importSubjects(data: any[]): Promise<SheetResult> {
    this.logger.log(`📥 Importando ${data.length} materias`);
    const result: SheetResult = { created: 0, errors: [] };
    
    if (data.length === 0) {
      result.errors.push('No hay datos para procesar');
      return result;
    }
    
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
        
        if (!subjectName || subjectName.length === 0) {
          result.errors.push(`Fila ${rowNumber}: Nombre de materia vacío`);
          continue;
        }
        
        // Buscar carrera
        const careerId = await this.findCareerIdentifier(row.career.toString());
        if (!careerId) {
          result.errors.push(`Fila ${rowNumber}: Carrera "${row.career}" no encontrada para materia "${subjectName}"`);
          this.logger.warn(`⚠️ Carrera no encontrada: "${row.career}" para materia ${subjectName}`);
          continue;
        }

        const subjectData = {
          name: subjectName,
          code: subjectCode,
          career: careerId,
          credits: row.credits ? parseInt(row.credits.toString()) || 4 : 4,
          semester: row.semester ? parseInt(row.semester.toString()) || 1 : 1,
        };

        this.logger.log(`📋 Procesando materia [Fila ${rowNumber}]: ${subjectName} (${subjectCode}) para carrera ${careerId}`);

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
        
        if (createResult) {
          // Verificar diferentes estructuras de respuesta
          const resultObj = createResult as any;
          let subjectId: string | null = null;
          
          if (resultObj._id) {
            subjectId = resultObj._id.toString();
          } else if (resultObj.success && resultObj.data) {
            if (resultObj.data._id) {
              subjectId = resultObj.data._id.toString();
            } else if (resultObj.data.data && resultObj.data.data._id) {
              subjectId = resultObj.data.data._id.toString();
            }
          } else if (resultObj.data && resultObj.data._id) {
            subjectId = resultObj.data._id.toString();
          }
          
          if (subjectId) {
            result.created++;
            this.logger.log(`✅ Materia creada: ${subjectName} (${subjectCode}) - ID: ${subjectId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Error al crear materia "${subjectName}" - Respuesta inválida`);
            this.logger.error(`❌ Respuesta inválida para materia:`, createResult);
          }
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear materia "${subjectName}" - Respuesta vacía`);
          this.logger.error(`❌ Respuesta vacía para materia: ${subjectName}`);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (materias):`, error.message);
        this.logger.error(error.stack);
        result.errors.push(`Fila ${rowNumber}: ${error.message}`);
      }
    }

    this.logger.log(`📊 Resultado materias: ${result.created} creadas, ${result.errors.length} errores`);
    return result;
  }

  /** ========== IMPORTAR GRUPOS ========== */
  private async importGroups(data: any[]): Promise<SheetResult> {
    this.logger.log(`📥 Importando ${data.length} grupos`);
    const result: SheetResult = { created: 0, errors: [] };
    
    if (data.length === 0) {
      result.errors.push('No hay datos para procesar');
      return result;
    }
    
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

        if (!groupName || groupName.length === 0) {
          result.errors.push(`Fila ${rowNumber}: Nombre de grupo vacío`);
          continue;
        }

        // Buscar materia
        const subjectId = await this.findSubjectIdentifier(row.subject.toString());
        if (!subjectId) {
          result.errors.push(`Fila ${rowNumber}: Materia "${row.subject}" no encontrada para grupo "${groupName}"`);
          this.logger.warn(`⚠️ Materia no encontrada: "${row.subject}" para grupo ${groupName}`);
          continue;
        }

        // Obtener la materia para obtener su carrera
        let careerId: string | undefined;
        try {
          const subjectResult = await this.subjectsService.findOne(subjectId);
          
          if (subjectResult) {
            const subject = subjectResult as any;
            if (subject.success && subject.data) {
              careerId = subject.data.careerId || subject.data.career?._id || subject.data.career;
            } else if (subject._id) {
              careerId = subject.careerId || subject.career?._id || subject.career;
            }
          }
        } catch (error) {
          this.logger.warn(`⚠️ No se pudo obtener carrera de la materia ${subjectId}: ${error.message}`);
        }

        // Preparar datos del grupo
        const groupData: any = {
          name: groupName,
          code: groupCode,
          subject: subjectId,
          schedule: row.schedule ? row.schedule.toString().trim() : '',
          capacity: row.capacity ? parseInt(row.capacity.toString()) || 30 : 30,
          active: row.active !== undefined ? Boolean(row.active) : true,
        };

        // Agregar carrera si se encontró
        if (careerId) {
          groupData.career = careerId;
          this.logger.log(`🔗 Grupo ${groupName} asignado a carrera: ${careerId}`);
        }

        // Buscar profesor si se especifica
        if (row.teacher && row.teacher.toString().trim()) {
          const teacherId = await this.findUserIdentifier(row.teacher.toString());
          if (teacherId) {
            groupData.teacher = teacherId;
            this.logger.log(`👨‍🏫 Profesor asignado al grupo ${groupName}: ${row.teacher} -> ${teacherId}`);
          } else {
            result.errors.push(`Fila ${rowNumber}: Profesor "${row.teacher}" no encontrado para grupo "${groupName}"`);
            this.logger.warn(`⚠️ Profesor no encontrado: "${row.teacher}" para grupo ${groupName}`);
          }
        }

        this.logger.log(`📋 Procesando grupo [Fila ${rowNumber}]: ${groupName} (${groupCode})`);

        // Crear grupo
        this.logger.log(`🔄 Creando grupo: ${groupName}`);
        const createResult = await this.groupsService.create(groupData);
        
        let groupId: string | undefined;
        
        // Extraer ID del grupo creado de diferentes estructuras de respuesta
        if (createResult) {
          const resultObj = createResult as any;
          
          if (resultObj._id) {
            groupId = resultObj._id.toString();
          } else if (resultObj.success && resultObj.data && resultObj.data._id) {
            groupId = resultObj.data._id.toString();
          } else if (resultObj.data && resultObj.data._id) {
            groupId = resultObj.data._id.toString();
          } else if (resultObj.data && resultObj.data.data && resultObj.data.data._id) {
            groupId = resultObj.data.data._id.toString();
          }
        }

        if (groupId) {
          result.created++;
          this.logger.log(`✅ Grupo creado: ${groupName} (ID: ${groupId})`);

          // Asignar estudiantes si se especifican
          if (row.students && row.students.toString().trim()) {
            await this.assignStudentsToGroup(groupId, row.students.toString(), rowNumber, result);
          }
        } else {
          result.errors.push(`Fila ${rowNumber}: Error al crear grupo "${groupName}" - No se obtuvo ID`);
          this.logger.error(`❌ No se obtuvo ID para grupo ${groupName}:`, createResult);
        }

      } catch (error: any) {
        this.logger.error(`❌ Error en fila ${rowNumber} (grupos):`, error.message);
        this.logger.error(error.stack);
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
    result: SheetResult
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
        
        if (careerResult) {
          const result = careerResult as any;
          if (result.success && result.data && result.data._id) {
            return result.data._id.toString();
          }
          if (result._id) {
            return result._id.toString();
          }
          if (result.data && result.data._id) {
            return result.data._id.toString();
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
        const result = careersResult as any;
        if (result.success && result.data) {
          if (Array.isArray(result.data)) {
            careersArray = result.data;
          } else if (result.data.data && Array.isArray(result.data.data)) {
            careersArray = result.data.data;
          }
        } else if (Array.isArray(careersResult)) {
          careersArray = careersResult;
        } else if (result.data && Array.isArray(result.data)) {
          careersArray = result.data;
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
        return found._id?.toString() || null;
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
        const result = careersResult as any;
        if (result.success && result.data) {
          if (Array.isArray(result.data)) {
            careersArray = result.data;
          } else if (result.data.data && Array.isArray(result.data.data)) {
            careersArray = result.data.data;
          }
        } else if (Array.isArray(careersResult)) {
          careersArray = careersResult;
        } else if (result.data && Array.isArray(result.data)) {
          careersArray = result.data;
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
        const result = subjectsResult as any;
        if (result.success && result.data) {
          if (Array.isArray(result.data)) {
            subjectsArray = result.data;
          } else if (result.data.data && Array.isArray(result.data.data)) {
            subjectsArray = result.data.data;
          }
        } else if (Array.isArray(subjectsResult)) {
          subjectsArray = subjectsResult;
        } else if (result.data && Array.isArray(result.data)) {
          subjectsArray = result.data;
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
          const result = subjectResult as any;
          if (result.success && result.data && result.data._id) {
            return result.data._id.toString();
          }
          if (result._id) {
            return result._id.toString();
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
        const result = subjectsResult as any;
        if (result.success && result.data) {
          if (Array.isArray(result.data)) {
            subjectsArray = result.data;
          } else if (result.data.data && Array.isArray(result.data.data)) {
            subjectsArray = result.data.data;
          }
        } else if (Array.isArray(subjectsResult)) {
          subjectsArray = subjectsResult;
        } else if (result.data && Array.isArray(result.data)) {
          subjectsArray = result.data;
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
        return found._id?.toString() || null;
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
    this.logger.log(`🔍 Buscando usuario con identificador: "${cleanId}"`);

    // 1. Verificar si es ObjectId válido
    if (Types.ObjectId.isValid(cleanId)) {
      try {
        const user = await this.usersService.findOne(cleanId);
        if (user && (user as any)._id) {
          this.logger.log(`✅ Usuario encontrado por ID: ${cleanId} -> ${(user as any)._id}`);
          return (user as any)._id.toString();
        }
      } catch (error) {
        this.logger.error(`❌ Error buscando usuario por ID ${cleanId}:`, error);
      }
    }

    // 2. Buscar por email (caso más común)
    if (cleanId.includes('@') && this.isValidEmail(cleanId)) {
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

    // 3. Buscar por nombre (menos común)
    try {
      // Podrías implementar búsqueda por nombre si es necesario
      this.logger.log(`ℹ️ Búsqueda por nombre no implementada para: "${cleanId}"`);
    } catch (error) {
      this.logger.error(`❌ Error buscando usuario por nombre ${cleanId}:`, error);
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

  /** Método de prueba */
  async testService(): Promise<{ success: boolean; message: string }> {
    try {
      this.logger.log('🧪 Probando ExcelService...');
      
      // Verificar que los servicios estén disponibles
      const services = [
        { name: 'usersService', service: this.usersService },
        { name: 'careersService', service: this.careersService },
        { name: 'subjectsService', service: this.subjectsService },
        { name: 'groupsService', service: this.groupsService }
      ];
      
      const unavailableServices = services.filter(s => !s.service);
      
      if (unavailableServices.length > 0) {
        const serviceNames = unavailableServices.map(s => s.name).join(', ');
        throw new Error(`Servicios no disponibles: ${serviceNames}`);
      }
      
      return {
        success: true,
        message: 'ExcelService funcionando correctamente'
      };
    } catch (error: any) {
      this.logger.error('❌ Error en testService:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}