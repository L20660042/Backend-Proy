import { IsNotEmpty } from 'class-validator';
import type { Multer } from 'multer';

export class UploadExcelDto {
  @IsNotEmpty()
  file: Multer.File;
}
