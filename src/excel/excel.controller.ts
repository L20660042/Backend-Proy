import { Controller, Post, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExcelService } from './excel.service';
import type { Multer } from 'multer';

@Controller('excel')
export class ExcelController {
  constructor(private readonly excelService: ExcelService) {}
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Multer.File) {
    return this.excelService.importExcel(file);
  }
  }

