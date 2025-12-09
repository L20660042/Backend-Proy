import { 
  Controller, 
  Post, 
  Get, 
  UploadedFile, 
  UseInterceptors, 
  Res, 
  UseGuards,
  BadRequestException,
  Req
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { diskStorage } from 'multer';
import { ExcelService } from './excel.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

// Definir la interfaz aquí ya que no está exportada desde el servicio
interface ImportResult {
  summary: {
    totalSheets: number;
    processedSheets: number;
    errors: string[];
    success: boolean;
    message: string;
    totalCreated: number;
  };
  details: Record<string, {
    created: number;
    errors: string[];
  }>;
}

@Controller('excel')
@UseGuards(JwtGuard, RolesGuard)
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/temp',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
        'application/vnd.ms-excel.sheet.macroEnabled.12',
        'text/csv',
        'text/plain'
      ];
      
      const allowedExtensions = ['.xlsx', '.xls', '.csv', '.txt'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedMimes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(
          `Tipo de archivo no permitido. Formatos aceptados: ${allowedExtensions.join(', ')}`
        ), false);
      }
    }
  }))
  async upload(@UploadedFile() file: Express.Multer.File): Promise<any> {
    console.log('📥 Archivo recibido en backend:', {
      originalname: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      path: file.path
    });
    
    try {
      const result = await this.excelService.importExcel(file);
      console.log('✅ Importación completada:', result.summary);
      return result;
    } catch (error: any) {
      console.error('❌ Error en importación:', error);
      throw error;
    }
  }

  @Get('template')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async downloadTemplate(@Res() res: Response) {
    try {
      console.log('📥 Solicitando plantilla Excel...');
      
      // Crear un libro de Excel
      const workbook = XLSX.utils.book_new();
      
      // ========== HOJA: CARRERAS ==========
      const carrerasData = [
        ['name', 'code', 'description', 'duration'],
        ['Ingeniería en Sistemas', 'IS', 'Descripción de la carrera', '8'],
        ['Ingeniería Industrial', 'II', 'Descripción de la carrera', '8'],
        ['Administración de Empresas', 'ADM', 'Descripción de la carrera', '8'],
        ['Contaduría Pública', 'CON', 'Descripción de la carrera', '8'],
        ['Psicología', 'PSI', 'Descripción de la carrera', '8']
      ];
      
      const carrerasSheet = XLSX.utils.aoa_to_sheet(carrerasData);
      
      // Establecer anchos de columna
      carrerasSheet['!cols'] = [
        { wch: 25 }, // name
        { wch: 10 }, // code
        { wch: 30 }, // description
        { wch: 10 }  // duration
      ];
      
      // ========== HOJA: USUARIOS ==========
      const usuariosData = [
        ['email', 'password', 'role', 'fullName', 'firstName', 'lastName', 'phone', 'career'],
        ['usuario@test.com', 'password123', 'ESTUDIANTE', 'Juan Pérez', 'Juan', 'Pérez', '5551234567', 'Ingeniería en Sistemas'],
        ['docente@test.com', 'password123', 'DOCENTE', 'María López', 'María', 'López', '', 'Ingeniería en Sistemas'],
        ['admin@test.com', 'password123', 'ADMIN', 'Carlos Ruiz', 'Carlos', 'Ruiz', '5559876543', ''],
        ['jefe@test.com', 'password123', 'JEFE_ACADEMICO', 'Ana García', 'Ana', 'García', '', 'Ingeniería en Sistemas'],
        ['tutor@test.com', 'password123', 'TUTOR', 'Pedro Sánchez', 'Pedro', 'Sánchez', '', 'Ingeniería en Sistemas']
      ];
      
      const usuariosSheet = XLSX.utils.aoa_to_sheet(usuariosData);
      
      usuariosSheet['!cols'] = [
        { wch: 25 }, // email
        { wch: 15 }, // password
        { wch: 20 }, // role
        { wch: 20 }, // fullName
        { wch: 15 }, // firstName
        { wch: 15 }, // lastName
        { wch: 15 }, // phone
        { wch: 25 }  // career
      ];
      
      // ========== HOJA: MATERIAS ==========
      const materiasData = [
        ['name', 'career', 'code', 'credits', 'semester'],
        ['Programación I', 'Ingeniería en Sistemas', 'PROG1', '4', '1'],
        ['Bases de Datos', 'Ingeniería en Sistemas', 'BD1', '4', '2'],
        ['Estructuras de Datos', 'Ingeniería en Sistemas', 'ED1', '4', '3'],
        ['Ingeniería de Software', 'Ingeniería en Sistemas', 'IS1', '4', '4'],
        ['Redes de Computadoras', 'Ingeniería en Sistemas', 'RC1', '4', '5'],
        ['Administración I', 'Administración de Empresas', 'ADM1', '4', '1'],
        ['Contabilidad', 'Contaduría Pública', 'CON1', '4', '1']
      ];
      
      const materiasSheet = XLSX.utils.aoa_to_sheet(materiasData);
      
      materiasSheet['!cols'] = [
        { wch: 30 }, // name
        { wch: 25 }, // career
        { wch: 10 }, // code
        { wch: 8 },  // credits
        { wch: 8 }   // semester
      ];
      
      // ========== HOJA: GRUPOS ==========
      const gruposData = [
        ['name', 'subject', 'teacher', 'schedule', 'capacity', 'students'],
        ['Grupo A - Mañana', 'PROG1', 'docente@test.com', 'Lunes y Miércoles 8:00-10:00', '30', 'usuario@test.com, estudiante2@test.com'],
        ['Grupo B - Tarde', 'BD1', 'docente@test.com', 'Martes y Jueves 14:00-16:00', '25', ''],
        ['Grupo C - Noche', 'ED1', '', 'Lunes, Miércoles y Viernes 18:00-20:00', '35', ''],
        ['Grupo A - Administración', 'ADM1', '', 'Martes y Jueves 10:00-12:00', '30', ''],
        ['Grupo A - Contabilidad', 'CON1', '', 'Lunes y Miércoles 16:00-18:00', '25', ''],
        ['Grupo B - Programación', 'PROG1', '', 'Martes y Jueves 8:00-10:00', '30', 'usuario@test.com']
      ];
      
      const gruposSheet = XLSX.utils.aoa_to_sheet(gruposData);
      
      gruposSheet['!cols'] = [
        { wch: 25 }, // name
        { wch: 15 }, // subject
        { wch: 20 }, // teacher
        { wch: 30 }, // schedule
        { wch: 10 }, // capacity
        { wch: 30 }  // students
      ];
      
      // ========== HOJA DE INSTRUCCIONES ==========
      const instruccionesData = [
        ['📋 INSTRUCCIONES DE USO - PLANTILLA METRICAMPUS'],
        [''],
        ['IMPORTANTE:'],
        ['1. NO cambie los nombres de las hojas (carreras, usuarios, materias, grupos)'],
        ['2. NO cambie los encabezados de columna (primera fila)'],
        ['3. Puede eliminar las filas de ejemplo para agregar sus propios datos'],
        ['4. Los campos marcados con * son obligatorios'],
        ['5. Use nombres o códigos en lugar de IDs'],
        [''],
        ['ORDEN RECOMENDADO DE IMPORTACIÓN:'],
        ['1. Carreras'],
        ['2. Usuarios'],
        ['3. Materias'],
        ['4. Grupos'],
        [''],
        ['FORMATOS ACEPTADOS:'],
        ['• Excel (.xlsx, .xls)'],
        ['• CSV (.csv)'],
        ['• Tamaño máximo: 10MB'],
        [''],
        ['CAMPO "role" - Valores aceptados:'],
        ['• SUPERADMIN'],
        ['• ADMIN'],
        ['• DOCENTE'],
        ['• ESTUDIANTE'],
        ['• JEFE_ACADEMICO'],
        ['• TUTOR'],
        ['• PSICOPEDAGOGICO'],
        ['• DESARROLLO_ACADEMICO'],
        ['• CAPACITACION'],
        [''],
        ['CAMPO "career" (en usuarios y materias):'],
        ['• Use el nombre EXACTO de la carrera (ej: "Ingeniería en Sistemas")'],
        ['• O use el código de la carrera (ej: "IS")'],
        ['• Asegúrese de que la carrera ya exista en la hoja "carreras"'],
        [''],
        ['CAMPO "subject" (en grupos):'],
        ['• Use el código EXACTO de la materia (ej: "PROG1")'],
        ['• O use el nombre de la materia (ej: "Programación I")'],
        ['• Asegúrese de que la materia ya exista en la hoja "materias"'],
        [''],
        ['CAMPO "teacher" y "students" (en grupos):'],
        ['• Use el email EXACTO del usuario (ej: "docente@test.com")'],
        ['• Para estudiantes: separar emails por coma (ej: "email1@test.com, email2@test.com")'],
        ['• Los usuarios deben existir en la hoja "usuarios"']
      ];
      
      const instruccionesSheet = XLSX.utils.aoa_to_sheet(instruccionesData);
      
      // Combinar celdas para el título
      instruccionesSheet['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
      ];
      
      // ========== AGREGAR HOJAS AL LIBRO ==========
      XLSX.utils.book_append_sheet(workbook, instruccionesSheet, '📋 INSTRUCCIONES');
      XLSX.utils.book_append_sheet(workbook, carrerasSheet, 'carreras');
      XLSX.utils.book_append_sheet(workbook, usuariosSheet, 'usuarios');
      XLSX.utils.book_append_sheet(workbook, materiasSheet, 'materias');
      XLSX.utils.book_append_sheet(workbook, gruposSheet, 'grupos');
      
      // ========== CONFIGURAR Y ENVIAR RESPONSE ==========
      const buffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx',
        bookSST: false
      });
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `plantilla_metricampus_${timestamp}.xlsx`;
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      console.log(`✅ Plantilla generada: ${filename} (${buffer.length} bytes)`);
      
      res.send(buffer);
      
    } catch (error: any) {
      console.error('❌ Error generando plantilla:', error);
      res.status(500).json({
        success: false,
        message: `Error generando plantilla: ${error.message}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  @Get('formats')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async getSupportedFormats() {
    return {
      success: true,
      formats: [
        {
          name: 'Excel Workbook',
          extension: '.xlsx',
          description: 'Formato recomendado',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        {
          name: 'Excel 97-2003',
          extension: '.xls',
          description: 'Formato compatible con versiones antiguas',
          mimeType: 'application/vnd.ms-excel'
        },
        {
          name: 'CSV',
          extension: '.csv',
          description: 'Valores separados por coma',
          mimeType: 'text/csv'
        }
      ],
      maxSize: '10MB',
      requiredSheets: ['carreras', 'usuarios', 'materias', 'grupos']
    };
  }

  @Get('test')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async test(@Req() req: any) {
    console.log('🧪 Probando funcionalidad Excel');
    
    try {
      // Obtener el usuario actual del request
      const currentUser = req.user;
      
      // Nota: No es buena práctica acceder a servicios privados así
      // Mejor agregar métodos públicos en ExcelService para test
      return {
        success: true,
        message: 'Endpoint de prueba disponible',
        currentUser: currentUser ? 'Autenticado' : 'No autenticado'
      };
      
    } catch (error: any) {
      console.error('❌ Error en test:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  @Get('uploads')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async getUploads() {
    // Por ahora devolver array vacío hasta que implementes la base de datos
    return {
      success: true,
      data: [],
      message: 'Endpoint para historial de importaciones (pendiente de implementar)'
    };
  }
}