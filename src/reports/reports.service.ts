import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { Tutoria, TutoriaDocument } from '../tutoria/schemas/tutoria.schema';
import { Capacitacion, CapacitacionDocument } from '../capacitacion/schemas/capacitacion.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Group, GroupDocument } from '../groups/schemas/group.schema';
import { Subject, SubjectDocument } from '../subjects/schemas/subject.schema';
import { Career, CareerDocument } from '../careers/schemas/career.schema';
import { Report, ReportDocument } from './schemas/report.schema';
import { GetReportsDto } from './dto/get-reports.dto';
import { GenerateReportDto } from './dto/generate-report.dto';
import * as ExcelJS from 'exceljs';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Tutoria.name) private tutoriaModel: Model<TutoriaDocument>,
    @InjectModel(Capacitacion.name) private capacitacionModel: Model<CapacitacionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(Career.name) private careerModel: Model<CareerDocument>,
    @InjectModel(Report.name) private reportModel: Model<ReportDocument>, // Nuevo modelo
  ) {}

  /** Generar reportes filtrados */
  async generate(dto: GetReportsDto): Promise<any> {
    const { type } = dto;

    switch (type) {
      case 'tutoria':
        return await this.getTutoriaReport(dto);
      case 'capacitacion':
        return await this.getCapacitacionReport(dto);
      case 'usuarios':
        return await this.getUsersReport(dto);
      case 'grupos':
        return await this.getGroupsReport(dto);
      case 'materias':
        return await this.getSubjectsReport(dto);
      default:
        return {
          tutorias: await this.getTutoriaReport(dto),
          capacitaciones: await this.getCapacitacionReport(dto),
          usuarios: await this.getUsersReport(dto),
          grupos: await this.getGroupsReport(dto),
          materias: await this.getSubjectsReport(dto),
        };
    }
  }

  /** Generar y guardar reporte con metadatos */
  async generateAndSaveReport(generateDto: GenerateReportDto, userId: string): Promise<any> {
    try {
      // Generar el reporte
      const data = await this.generate(generateDto);
      
      // Calcular estadísticas
      const stats = this.calculateStatistics(data, generateDto.type);
      
      // Crear metadatos del reporte
      const reportData = {
        name: generateDto.name,
        description: generateDto.description,
        type: generateDto.type,
        format: generateDto.format || 'json',
        filters: {
          userId: generateDto.userId,
          studentId: generateDto.studentId,
          groupId: generateDto.groupId,
          subjectId: generateDto.subjectId,
          careerId: generateDto.careerId,
          startDate: generateDto.startDate,
          endDate: generateDto.endDate,
        },
        dataSize: JSON.stringify(data).length,
        recordCount: Array.isArray(data) ? data.length : this.countTotalRecords(data),
        stats: stats,
        generatedBy: userId,
        status: 'completed',
        downloadCount: 0,
      };

      // Guardar en base de datos
      const savedReport = await this.reportModel.create(reportData);
      
      return {
        success: true,
        message: 'Reporte generado y guardado exitosamente',
        data: {
          report: savedReport,
          preview: Array.isArray(data) ? data.slice(0, 10) : data // Primeros 10 registros para preview
        }
      };
    } catch (error) {
      throw new BadRequestException(`Error al generar reporte: ${error.message}`);
    }
  }

  /** Obtener historial de reportes */
  async getReportHistory(userId?: string, limit: number = 50, page: number = 1): Promise<any> {
    const filter: any = {};
    if (userId) filter.generatedBy = userId;

    const skip = (page - 1) * limit;
    
    const [reports, total] = await Promise.all([
      this.reportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.reportModel.countDocuments(filter)
    ]);

    return {
      success: true,
      data: reports,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: (page * limit) < total,
        hasPrev: page > 1
      }
    };
  }

  /** Exportar reporte a diferentes formatos */
  async exportReport(reportId: string, format: string = 'json', res: Response): Promise<void> {
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }

    // Incrementar contador de descargas
    report.downloadCount += 1;
    await report.save();

    // Generar datos del reporte
    const data = await this.generate({
      type: report.type,
      ...report.filters
    });

    switch (format.toLowerCase()) {
      case 'json':
        await this.exportToJSON(data, report, res);
        break;
      case 'csv':
        await this.exportToCSV(data, report, res);
        break;
      case 'excel':
        await this.exportToExcel(data, report, res);
        break;
      case 'pdf':
        await this.exportToPDF(data, report, res);
        break;
      default:
        throw new BadRequestException('Formato no soportado. Usa: json, csv, excel o pdf');
    }
  }

  /** Exportar a JSON */
  private async exportToJSON(data: any, report: any, res: Response): Promise<void> {
    const result = {
      report: {
        id: report._id,
        name: report.name,
        description: report.description,
        type: report.type,
        generatedAt: report.createdAt,
        generatedBy: report.generatedBy,
        filters: report.filters,
        stats: report.stats,
      },
      data: data
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.json"`);
    res.send(JSON.stringify(result, null, 2));
  }

  /** Exportar a CSV */
  private async exportToCSV(data: any, report: any, res: Response): Promise<void> {
    let csvContent = '';
    
    // Encabezados
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]).join(',');
      csvContent += headers + '\n';
      
      // Filas
      data.forEach(item => {
        const row = Object.values(item).map(value => {
          if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += row + '\n';
      });
    } else if (typeof data === 'object') {
      // Para reportes no tabulares
      csvContent = this.objectToCSV(data);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.csv"`);
    res.send(csvContent);
  }

  /** Exportar a Excel */
  private async exportToExcel(data: any, report: any, res: Response): Promise<void> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte');

    // Encabezados
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      worksheet.addRow(headers);

      // Estilo para encabezados
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      // Datos
      data.forEach(item => {
        const row = headers.map(header => {
          const value = item[header];
          if (value instanceof Date) {
            return value;
          } else if (typeof value === 'object') {
            return JSON.stringify(value);
          }
          return value;
        });
        worksheet.addRow(row);
      });

      // Auto ajustar columnas
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    }

    // Hoja de metadatos
    const metaSheet = workbook.addWorksheet('Metadatos');
    metaSheet.addRow(['Nombre', report.name]);
    metaSheet.addRow(['Descripción', report.description || 'N/A']);
    metaSheet.addRow(['Tipo', report.type]);
    metaSheet.addRow(['Fecha de generación', report.createdAt]);
    metaSheet.addRow(['Total registros', report.recordCount]);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.xlsx"`);
    
    await workbook.xlsx.write(res);
    res.end();
  }

  /** Exportar a PDF */
  private async exportToPDF(data: any, report: any, res: Response): Promise<void> {
    const doc = new PDFDocument({ margin: 50 });
    
    // Configurar respuesta
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.pdf"`);
    
    doc.pipe(res);

    // Encabezado
    doc.fontSize(20).text(report.name, { align: 'center' });
    doc.moveDown();
    
    if (report.description) {
      doc.fontSize(12).text(report.description);
      doc.moveDown();
    }

    // Metadatos
    doc.fontSize(10).text(`Tipo: ${report.type}`);
    doc.text(`Generado: ${new Date(report.createdAt).toLocaleDateString()}`);
    doc.text(`Total registros: ${report.recordCount}`);
    doc.moveDown();

    // Datos
    if (Array.isArray(data) && data.length > 0) {
      doc.fontSize(14).text('Datos:', { underline: true });
      doc.moveDown(0.5);
      
      data.slice(0, 100).forEach((item, index) => { // Limitar a 100 registros en PDF
        doc.fontSize(10).text(`${index + 1}. ${JSON.stringify(item, null, 2)}`);
        doc.moveDown(0.5);
      });

      if (data.length > 100) {
        doc.moveDown();
        doc.fontSize(10).text(`... y ${data.length - 100} registros más. Descarga el archivo completo para ver todos los datos.`);
      }
    }

    doc.end();
  }

  /** Métodos auxiliares privados */
  private calculateStatistics(data: any, type: string): any {
    const stats: any = {};

    if (Array.isArray(data)) {
      stats.totalRecords = data.length;
      
      if (type === 'tutoria') {
        const withRisk = data.filter((item: any) => item.riskDetected).length;
        stats.tutoriasWithRisk = withRisk;
        stats.tutoriasWithoutRisk = data.length - withRisk;
        
        // Por mes (si hay fechas)
        const byMonth: Record<string, number> = {};
        data.forEach((item: any) => {
          if (item.date) {
            const month = new Date(item.date).toLocaleString('es', { month: 'short' });
            byMonth[month] = (byMonth[month] || 0) + 1;
          }
        });
        stats.byMonth = byMonth;
      }
      
      if (type === 'usuarios') {
        const byRole: Record<string, number> = {};
        data.forEach((user: any) => {
          byRole[user.role] = (byRole[user.role] || 0) + 1;
        });
        stats.byRole = byRole;
        stats.activeUsers = data.filter((user: any) => user.active).length;
      }
    }

    return stats;
  }

  private countTotalRecords(data: any): number {
    if (Array.isArray(data)) return data.length;
    
    if (typeof data === 'object') {
      return Object.values(data).reduce((total: number, value: any) => {
        if (Array.isArray(value)) return total + value.length;
        return total + 1;
      }, 0);
    }
    
    return 0;
  }

  private objectToCSV(obj: any): string {
    const rows: string[] = [];
    
    const flattenObject = (ob: any, prefix = ''): void => {
      for (const key in ob) {
        if (ob.hasOwnProperty(key)) {
          const value = ob[key];
          const newKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            flattenObject(value, newKey);
          } else {
            rows.push(`"${newKey}","${String(value).replace(/"/g, '""')}"`);
          }
        }
      }
    };
    
    flattenObject(obj);
    return 'Clave,Valor\n' + rows.join('\n');
  }

  /** Métodos de los reportes individuales (existentes) */
  private async getTutoriaReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter.tutor = new Types.ObjectId(dto.userId);
    if (dto.studentId) filter.student = new Types.ObjectId(dto.studentId);
    if (dto.groupId) filter.group = new Types.ObjectId(dto.groupId);
    if (dto.startDate || dto.endDate) filter.date = {};
    if (dto.startDate) filter.date.$gte = new Date(dto.startDate);
    if (dto.endDate) filter.date.$lte = new Date(dto.endDate);

    return this.tutoriaModel.find(filter)
      .populate('tutor')
      .populate('student')
      .populate('group')
      .sort({ date: -1 })
      .lean()
      .exec();
  }

  private async getCapacitacionReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter.teacher = new Types.ObjectId(dto.userId);
    if (dto.startDate || dto.endDate) filter.date = {};
    if (dto.startDate) filter.date.$gte = new Date(dto.startDate);
    if (dto.endDate) filter.date.$lte = new Date(dto.endDate);

    return this.capacitacionModel.find(filter)
      .populate('teacher')
      .sort({ date: -1 })
      .lean()
      .exec();
  }

  private async getUsersReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.userId) filter._id = new Types.ObjectId(dto.userId);
    return this.userModel.find(filter).sort({ name: 1 }).lean().exec();
  }

  private async getGroupsReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.groupId) filter._id = new Types.ObjectId(dto.groupId);
    if (dto.subjectId) filter.subject = new Types.ObjectId(dto.subjectId);
    if (dto.careerId) filter.career = new Types.ObjectId(dto.careerId);
    return this.groupModel.find(filter)
      .populate('teacher')
      .populate('subject')
      .populate('students')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  private async getSubjectsReport(dto: GetReportsDto) {
    const filter: any = {};
    if (dto.subjectId) filter._id = new Types.ObjectId(dto.subjectId);
    if (dto.careerId) filter.career = new Types.ObjectId(dto.careerId);
    return this.subjectModel.find(filter)
      .populate('career')
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  /** Obtener un reporte por ID */
  async getReportById(reportId: string): Promise<any> {
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return report;
  }

  /** Eliminar un reporte */
  async deleteReport(reportId: string): Promise<any> {
    const report = await this.reportModel.findByIdAndDelete(reportId);
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return {
      success: true,
      message: 'Reporte eliminado exitosamente',
      data: report
    };
  }

  /** Obtener estadísticas generales del sistema */
  async getSystemStats(): Promise<any> {
    const [
      totalUsers,
      activeUsers,
      totalCareers,
      activeCareers,
      totalSubjects,
      totalGroups,
      totalTutorias,
      recentTutorias,
      totalCapacitaciones,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ active: true }),
      this.careerModel.countDocuments(),
      this.careerModel.countDocuments({ active: true }),
      this.subjectModel.countDocuments(),
      this.groupModel.countDocuments(),
      this.tutoriaModel.countDocuments(),
      this.tutoriaModel.countDocuments({
        date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }),
      this.capacitacionModel.countDocuments(),
    ]);

    return {
      usuarios: {
        total: totalUsers,
        activos: activeUsers,
        inactivos: totalUsers - activeUsers
      },
      carreras: {
        total: totalCareers,
        activas: activeCareers,
        inactivas: totalCareers - activeCareers
      },
      materias: {
        total: totalSubjects
      },
      grupos: {
        total: totalGroups
      },
      tutorias: {
        total: totalTutorias,
        ultimos30Dias: recentTutorias
      },
      capacitaciones: {
        total: totalCapacitaciones
      }
    };
  }
}