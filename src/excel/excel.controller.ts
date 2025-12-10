import { 
  Controller, 
  Post, 
  Get, 
  UploadedFile, 
  UseInterceptors, 
  Res, 
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { diskStorage } from 'multer';
import { ExcelService } from './excel.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../common/enums';

@Controller('excel')
@UseGuards(JwtGuard, RolesGuard)
export class ExcelController {
  private readonly logger = new Logger(ExcelController.name);

  constructor(private readonly excelService: ExcelService) {
    this.logger.log('✅ ExcelController inicializado');
  }

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const tmpDir = os.tmpdir();
        const uploadDir = path.join(tmpDir, 'metricampus-uploads');
        
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      }
    }),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = path.extname(file.originalname).toLowerCase();
      
      if (allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        cb(new BadRequestException(
          `Formato no permitido. Usa: ${allowedExtensions.join(', ')}`
        ), false);
      }
    }
  }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined): Promise<any> {
    this.logger.log('📥 ========== INICIO UPLOAD ==========');
    
    // Verificar que el archivo existe
    if (!file) {
      throw new BadRequestException('No se recibió archivo');
    }

    // Log con verificaciones seguras
    this.logger.log('📥 Archivo recibido:', {
      originalname: file?.originalname,
      size: file?.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A',
      mimetype: file?.mimetype,
      path: file?.path,
      bufferExists: !!file?.buffer,
      bufferLength: file?.buffer?.length || 0
    });

    try {
      // Preparar buffer del archivo
      let fileBuffer: Buffer;
      
      if (file.buffer && file.buffer.length > 0) {
        fileBuffer = file.buffer;
        this.logger.log(`✅ Usando buffer: ${fileBuffer.length} bytes`);
      } else if (file.path && fs.existsSync(file.path)) {
        this.logger.log(`📂 Leyendo de disco: ${file.path}`);
        fileBuffer = fs.readFileSync(file.path);
        this.logger.log(`✅ Leído del disco: ${fileBuffer.length} bytes`);
      } else {
        throw new BadRequestException('No se pudo leer el archivo');
      }

      // Validar formato con encadenamiento opcional
      const fileNameParts = file.originalname?.split('.') || [];
      const fileExtension = fileNameParts.length > 1 
        ? fileNameParts.pop()?.toLowerCase() 
        : undefined;
      
      const allowedExtensions = ['xlsx', 'xls', 'csv'];
      
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        throw new BadRequestException(`Formato no soportado. Usa: ${allowedExtensions.join(', ')}`);
      }

      // Procesar archivo
      this.logger.log('🔄 Iniciando procesamiento del archivo...');
      
      const result = await this.excelService.importExcel({
        ...file,
        buffer: fileBuffer
      });

      // Limpiar archivo temporal
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          this.logger.log(`🗑️ Archivo temporal eliminado: ${file.path}`);
        } catch (cleanupError: any) {
          this.logger.warn(`⚠️ No se pudo eliminar temporal: ${cleanupError?.message || 'Error desconocido'}`);
        }
      }

      this.logger.log('✅ ========== UPLOAD COMPLETADO ==========');
      return result;

    } catch (error: any) {
      this.logger.error('❌ Error en upload:', {
        message: error?.message || 'Error desconocido',
        stack: error?.stack,
        name: error?.name
      });

      // Limpiar en caso de error
      if (file?.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
          this.logger.log(`🗑️ Archivo eliminado tras error: ${file.path}`);
        } catch (cleanupError: any) {
          this.logger.warn(`⚠️ Error limpiando: ${cleanupError?.message || 'Error desconocido'}`);
        }
      }

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Error procesando archivo: ${error?.message || 'Error desconocido'}`
      );
    }
  }

  @Get('template')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async downloadTemplate(@Res() res: Response) {
    try {
      this.logger.log('📥 Generando plantilla Excel...');
      
      const workbook = XLSX.utils.book_new();
      
      // Hoja de carreras
      const carrerasData = [
        ['name', 'code', 'description', 'duration', 'active'],
        ['Ingeniería en Sistemas', 'IS', 'Carrera de Ingeniería', '8', 'true'],
        ['Administración', 'ADM', 'Carrera de Administración', '8', 'true'],
        ['Contaduría', 'CON', 'Carrera de Contaduría', '8', 'true']
      ];
      
      const carrerasSheet = XLSX.utils.aoa_to_sheet(carrerasData);
      // Verificar que existe antes de asignar
      if (carrerasSheet) {
        carrerasSheet['!cols'] = [
          { wch: 25 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 8 }
        ];
      }

      // Hoja de usuarios
      const usuariosData = [
        ['email', 'password', 'role', 'fullName', 'firstName', 'lastName', 'phone', 'career'],
        ['admin@test.com', 'password123', 'ADMIN', 'Admin User', 'Admin', 'User', '', ''],
        ['docente@test.com', 'password123', 'DOCENTE', 'Profesor Test', 'Profesor', 'Test', '', 'Ingeniería en Sistemas'],
        ['estudiante@test.com', 'password123', 'ESTUDIANTE', 'Estudiante Test', 'Estudiante', 'Test', '', 'Ingeniería en Sistemas']
      ];
      
      const usuariosSheet = XLSX.utils.aoa_to_sheet(usuariosData);
      if (usuariosSheet) {
        usuariosSheet['!cols'] = [
          { wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 20 },
          { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 25 }
        ];
      }

      // Hoja de materias
      const materiasData = [
        ['name', 'code', 'career', 'credits', 'semester'],
        ['Programación I', 'PROG1', 'Ingeniería en Sistemas', '4', '1'],
        ['Bases de Datos', 'BD1', 'Ingeniería en Sistemas', '4', '2'],
        ['Matemáticas', 'MAT1', 'Ingeniería en Sistemas', '4', '1']
      ];
      
      const materiasSheet = XLSX.utils.aoa_to_sheet(materiasData);
      if (materiasSheet) {
        materiasSheet['!cols'] = [
          { wch: 25 }, { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 8 }
        ];
      }

      // Hoja de grupos
      const gruposData = [
        ['name', 'code', 'subject', 'teacher', 'schedule', 'capacity', 'students'],
        ['Grupo A', 'GRP-A', 'PROG1', 'docente@test.com', 'Lunes 8:00-10:00', '30', 'estudiante@test.com'],
        ['Grupo B', 'GRP-B', 'BD1', '', 'Martes 10:00-12:00', '25', '']
      ];
      
      const gruposSheet = XLSX.utils.aoa_to_sheet(gruposData);
      if (gruposSheet) {
        gruposSheet['!cols'] = [
          { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 20 },
          { wch: 25 }, { wch: 10 }, { wch: 30 }
        ];
      }

      // Agregar hojas solo si existen
      if (carrerasSheet) {
        XLSX.utils.book_append_sheet(workbook, carrerasSheet, 'carreras');
      }
      if (usuariosSheet) {
        XLSX.utils.book_append_sheet(workbook, usuariosSheet, 'usuarios');
      }
      if (materiasSheet) {
        XLSX.utils.book_append_sheet(workbook, materiasSheet, 'materias');
      }
      if (gruposSheet) {
        XLSX.utils.book_append_sheet(workbook, gruposSheet, 'grupos');
      }

      // Generar buffer
      const buffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx'
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `plantilla_metricampus_${timestamp}.xlsx`;

      // Configurar headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      this.logger.log(`✅ Plantilla generada: ${filename} (${buffer.length} bytes)`);
      res.send(buffer);

    } catch (error: any) {
      this.logger.error('❌ Error generando plantilla:', error);
      res.status(500).json({
        success: false,
        message: `Error: ${error?.message || 'Error desconocido'}`
      });
    }
  }

  @Get('test')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async test() {
    try {
      this.logger.log('🧪 Probando servicio Excel...');
      
      // Verificar que todos los servicios estén disponibles
      const testResult = await this.excelService.testService();
      
      return {
        success: true,
        message: 'Excel service funcionando',
        details: testResult,
        timestamp: new Date().toISOString()
      };
      
    } catch (error: any) {
      this.logger.error('❌ Test falló:', error);
      return {
        success: false,
        message: error?.message || 'Error desconocido'
      };
    }
  }

  @Get('status')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async getStatus() {
    return {
      success: true,
      service: 'Excel Import Service',
      status: 'active',
      endpoints: [
        { method: 'POST', path: '/excel/upload', description: 'Importar archivo Excel' },
        { method: 'GET', path: '/excel/template', description: 'Descargar plantilla' },
        { method: 'GET', path: '/excel/test', description: 'Probar servicio' }
      ],
      supportedFormats: ['xlsx', 'xls', 'csv'],
      maxFileSize: '10MB',
      requiredSheets: ['carreras', 'usuarios', 'materias', 'grupos']
    };
  }

  @Get('debug/test-import')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async testImport() {
    try {
      this.logger.log('🧪 Creando archivo de prueba para importación...');
      
      // Crear un archivo Excel de prueba simple
      const workbook = XLSX.utils.book_new();
      
      // Hoja de carreras con nombres de columnas en español
      const carrerasData = [
        ['Nombre', 'Código', 'Descripción', 'Duración', 'Activo'],
        ['Ingeniería en Sistemas', 'ISIS', 'Ingeniería en Sistemas Computacionales', '8', 'Si'],
        ['Administración', 'ADM', 'Licenciatura en Administración', '8', 'True'],
        ['Contaduría', 'CONTA', 'Licenciatura en Contaduría', '8', '1']
      ];
      
      const carrerasSheet = XLSX.utils.aoa_to_sheet(carrerasData);
      XLSX.utils.book_append_sheet(workbook, carrerasSheet, 'Carreras');

      // Hoja de usuarios con nombres de columnas en español
      const usuariosData = [
        ['Email', 'Rol', 'Nombre Completo', 'Contraseña', 'Carrera'],
        ['admin@test.com', 'ADMIN', 'Administrador Principal', 'admin123', 'Ingeniería en Sistemas'],
        ['docente@test.com', 'DOCENTE', 'Profesor de Prueba', 'docente123', 'Ingeniería en Sistemas'],
        ['estudiante@test.com', 'ESTUDIANTE', 'Estudiante Ejemplo', 'estudiante123', 'Ingeniería en Sistemas']
      ];
      
      const usuariosSheet = XLSX.utils.aoa_to_sheet(usuariosData);
      XLSX.utils.book_append_sheet(workbook, usuariosSheet, 'Usuarios');

      // Generar buffer
      const buffer = XLSX.write(workbook, { 
        type: 'buffer', 
        bookType: 'xlsx'
      });

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `archivo_prueba_${timestamp}.xlsx`;

      // Crear archivo de prueba en temp
      const tmpDir = os.tmpdir();
      const uploadDir = path.join(tmpDir, 'metricampus-uploads');
      
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      
      this.logger.log(`✅ Archivo de prueba creado: ${filePath}`);
      
      return {
        success: true,
        message: 'Archivo de prueba creado',
        filePath: filePath,
        downloadUrl: `/excel/debug/download-test?file=${filename}`
      };

    } catch (error: any) {
      this.logger.error('❌ Error creando archivo de prueba:', error);
      return {
        success: false,
        message: error?.message || 'Error desconocido'
      };
    }
  }

  @Get('debug/download-test')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async downloadTestFile(@Res() res: Response) {
    try {
      const tmpDir = os.tmpdir();
      const uploadDir = path.join(tmpDir, 'metricampus-uploads');
      const filename = 'archivo_prueba.xlsx';
      const filePath = path.join(uploadDir, filename);
      
      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('Archivo de prueba no encontrado');
      }
      
      const fileBuffer = fs.readFileSync(filePath);
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileBuffer.length);
      
      res.send(fileBuffer);
      
    } catch (error: any) {
      this.logger.error('❌ Error descargando archivo de prueba:', error);
      res.status(500).json({
        success: false,
        message: error?.message || 'Error desconocido'
      });
    }
  }
}