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

@Injectable()
export class ReportsService {

  constructor(
    @InjectModel(Report.name) public reportModel: Model<ReportDocument>,
    @InjectModel(Tutoria.name) private tutoriaModel: Model<TutoriaDocument>,
    @InjectModel(Capacitacion.name) private capacitacionModel: Model<CapacitacionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Subject.name) private subjectModel: Model<SubjectDocument>,
    @InjectModel(Career.name) private careerModel: Model<CareerDocument>,
  ) {}

  // ========== NUEVO: OBTENER TODOS LOS REPORTES ==========
  async getAllReports(filter: any = {}, page: number = 1, limit: number = 50): Promise<any> {
    try {
      console.log('🔍 Buscando reportes con filtro:', filter);
      
      const query: any = {};
      
      // Aplicar filtros
      if (filter.type) query.type = filter.type;
      if (filter.status) query.status = filter.status;
      
      // Búsqueda por texto
      if (filter.search) {
        query.$or = [
          { name: { $regex: filter.search, $options: 'i' } },
          { description: { $regex: filter.search, $options: 'i' } }
        ];
      }
      
      const skip = (page - 1) * limit;
      
      const [reports, total] = await Promise.all([
        this.reportModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('generatedBy', 'fullName email')
          .lean(),
        this.reportModel.countDocuments(query)
      ]);
      
      console.log(`✅ Encontrados ${reports.length} reportes de ${total} totales`);
      
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
    } catch (error: any) {
      console.error('❌ Error al obtener reportes:', error);
      throw new BadRequestException(`Error al obtener reportes: ${error.message}`);
    }
  }

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
      console.log('🚀 Iniciando generación de reporte:', generateDto);
      
      // Convertir GenerateReportDto a GetReportsDto
      const getReportsDto: GetReportsDto = {
        type: generateDto.type as any,
        userId: generateDto.userId,
        studentId: generateDto.studentId,
        groupId: generateDto.groupId,
        subjectId: generateDto.subjectId,
        careerId: generateDto.careerId,
        startDate: generateDto.startDate,
        endDate: generateDto.endDate,
      };

      // Generar el reporte
      const data = await this.generate(getReportsDto);
      
      console.log('📊 Datos generados, calculando estadísticas...');
      
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
          startDate: generateDto.startDate ? new Date(generateDto.startDate) : undefined,
          endDate: generateDto.endDate ? new Date(generateDto.endDate) : undefined,
        },
        dataSize: JSON.stringify(data).length,
        recordCount: Array.isArray(data) ? data.length : this.countTotalRecords(data),
        stats: stats,
        generatedBy: new Types.ObjectId(userId),
        status: 'completed',
        downloadCount: 0,
      };

      console.log('📝 Guardando reporte en BD:', reportData);
      
      // Guardar en base de datos
      const savedReport = await this.reportModel.create(reportData);
      
      console.log('✅ Reporte guardado con ID:', savedReport._id);

      // Verificar que se guardó correctamente
      const verifyReport = await this.reportModel.findById(savedReport._id);
      console.log('🔍 Reporte verificado:', {
        id: verifyReport?._id,
        name: verifyReport?.name,
        type: verifyReport?.type,
        status: verifyReport?.status
      });
      
      return {
        success: true,
        message: 'Reporte generado y guardado exitosamente',
        data: {
          report: savedReport,
          preview: Array.isArray(data) ? data.slice(0, 10) : data
        }
      };
    } catch (error: any) {
      console.error('❌ Error al generar reporte:', error);
      throw new BadRequestException(`Error al generar reporte: ${error.message}`);
    }
  }

  /** Obtener historial de reportes */
  async getReportHistory(userId?: string, limit: number = 50, page: number = 1): Promise<any> {
    const filter: any = {};
    if (userId) filter.generatedBy = new Types.ObjectId(userId);

    const skip = (page - 1) * limit;
    
    const [reports, total] = await Promise.all([
      this.reportModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('generatedBy', 'fullName email')
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
    const getReportsDto: GetReportsDto = {
      type: report.type as any,
      userId: report.filters?.userId,
      studentId: report.filters?.studentId,
      groupId: report.filters?.groupId,
      subjectId: report.filters?.subjectId,
      careerId: report.filters?.careerId,
      startDate: report.filters?.startDate?.toISOString(),
      endDate: report.filters?.endDate?.toISOString(),
    };
    
    const data = await this.generate(getReportsDto);

    // Solo soportamos JSON y CSV por ahora
    if (format.toLowerCase() === 'json') {
      await this.exportToJSON(data, report, res);
    } else if (format.toLowerCase() === 'csv') {
      await this.exportToCSV(data, report, res);
    } else {
      throw new BadRequestException('Formato no soportado. Usa: json o csv');
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
    
    if (Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]).join(',');
      csvContent += headers + '\n';
      
      data.forEach(item => {
        const row = Object.values(item).map(value => {
          if (typeof value === 'object' && value !== null) {
            return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
          }
          return `"${String(value).replace(/"/g, '""')}"`;
        }).join(',');
        csvContent += row + '\n';
      });
    } else if (typeof data === 'object') {
      csvContent = this.objectToCSV(data);
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${report.name.replace(/\s+/g, '_')}.csv"`);
    res.send(csvContent);
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
      let total = 0;
      Object.values(data).forEach((value: any) => {
        if (Array.isArray(value)) {
          total += value.length;
        } else {
          total += 1;
        }
      });
      return total;
    }
    
    return 0;
  }

  private objectToCSV(obj: any): string {
    const rows: string[] = [];
    
    const flattenObject = (ob: any, prefix = ''): void => {
      for (const key in ob) {
        if (Object.prototype.hasOwnProperty.call(ob, key)) {
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

  /** Métodos de los reportes individuales */
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
    const report = await this.reportModel.findById(reportId)
      .populate('generatedBy', 'fullName email');
    if (!report) {
      throw new NotFoundException('Reporte no encontrado');
    }
    return {
      success: true,
      data: report
    };
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
      totalReports,
      completedReports,
      processingReports,
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
      this.reportModel.countDocuments(),
      this.reportModel.countDocuments({ status: 'completed' }),
      this.reportModel.countDocuments({ status: 'processing' }),
    ]);

    return {
      success: true,
      data: {
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
        },
        reportes: {
          total: totalReports,
          completados: completedReports,
          procesando: processingReports,
          otros: totalReports - completedReports - processingReports
        }
      }
    };
  }

  /** Método para debug - Obtener todos los reportes */
  async debugGetAllReports(): Promise<any> {
    const reports = await this.reportModel.find({})
      .sort({ createdAt: -1 })
      .populate('generatedBy', 'fullName email')
      .lean();
    
    const count = await this.reportModel.countDocuments();
    
    return {
      success: true,
      message: `Hay ${count} reportes en la base de datos`,
      count,
      reports: reports.map(r => ({
        id: r._id,
        name: r.name,
        type: r.type,
        status: r.status,
        format: r.format,
        createdAt: (r as any).createdAt, // Cast para acceder a createdAt
        generatedBy: r.generatedBy,
        recordCount: r.recordCount,
        downloadCount: r.downloadCount
      }))
    };
  }
}