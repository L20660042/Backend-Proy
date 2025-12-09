import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CareersModule } from './careers/careers.module';
import { SubjectsModule } from './subjects/subjects.module';
import { GroupsModule } from './groups/groups.module';
import { TutoriaModule } from './tutoria/tutoria.module';
import { CapacitacionModule } from './capacitacion/capacitacion.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReportsModule } from './reports/reports.module';
import { FiltersModule } from './filters/filters.module';
import { ExcelModule } from './excel/excel.module';

@Module({
  imports: [
    // Configuración de Multer para archivos Excel
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads/temp',
        filename: (req, file, callback) => {
          // Generar nombre único para evitar conflictos
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          const filename = `${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // Límite de 10MB
      },
      fileFilter: (req, file, callback) => {
        // Validar extensiones permitidas
        const allowedExtensions = ['.xlsx', '.xls', '.csv'];
        const fileExtension = extname(file.originalname).toLowerCase();
        
        // Validar MIME types
        const allowedMimeTypes = [
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/csv',
          'application/vnd.oasis.opendocument.spreadsheet'
        ];
        
        if (
          allowedExtensions.includes(fileExtension) ||
          allowedMimeTypes.includes(file.mimetype)
        ) {
          callback(null, true);
        } else {
          callback(new Error(`Formato de archivo no soportado. Use: ${allowedExtensions.join(', ')}`), false);
        }
      },
    }),
    
    // Conexión a MongoDB
    MongooseModule.forRoot(
      'mongodb+srv://luistoarzola_db_user:oPySQBXAF7EodFNX@proyecto.gdcgnsp.mongodb.net/',
      { dbName: 'proyecto1', autoIndex: true },
    ),
    
    // Módulos de la aplicación
    UsersModule,
    AuthModule,
    CareersModule,
    SubjectsModule,
    GroupsModule,
    TutoriaModule,
    CapacitacionModule,
    AlertsModule,
    ReportsModule,
    FiltersModule,
    ExcelModule, 
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}