import { IsNotEmpty } from 'class-validator';

export class UploadExcelDto {
  @IsNotEmpty({ message: 'Archivo es requerido' })
  file: Express.Multer.File;
}