import { IsNotEmpty } from 'class-validator';
import type { Express } from 'express';

export class UploadExcelDto {
  @IsNotEmpty()
  file: Express.Multer.File;
}
