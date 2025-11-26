import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Get, 
  HttpException, 
  HttpStatus 
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../Permisos/permissions.guard';
import { Permissions } from '../Permisos/permissions.decorator';
import { AnalyticsService } from './analytics.service';

interface StudentRiskAnalysisDto {
  grades: number[];
  attendance: number[];
  tutoring_sessions: number;
  evaluation_scores: number[];
  student_id?: string;
}

interface FeedbackAnalysisDto {
  text: string;
  context?: string;
  student_id?: string;
  teacher_id?: string;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('student-risk')
  @Permissions('academic:supervision', 'reports:view')
  async analyzeStudentRisk(@Body() riskData: StudentRiskAnalysisDto) {
    try {
      const result = await this.analyticsService.analyzeStudentRisk({
        grades: riskData.grades,
        attendance: riskData.attendance,
        tutoring_sessions: riskData.tutoring_sessions,
        evaluation_scores: riskData.evaluation_scores
      });

      return {
        success: true,
        data: {
          ...result,
          student_id: riskData.student_id,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error en el análisis de riesgo',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('feedback-sentiment')
  @Permissions('academic:supervision', 'reports:view')
  async analyzeFeedbackSentiment(@Body() feedbackData: FeedbackAnalysisDto) {
    try {
      const result = await this.analyticsService.analyzeFeedbackSentiment({
        text: feedbackData.text,
        context: feedbackData.context || 'general'
      });

      return {
        success: true,
        data: {
          ...result,
          student_id: feedbackData.student_id,
          teacher_id: feedbackData.teacher_id,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error en el análisis de sentimiento',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('health')
  async checkServiceHealth() {
    try {
      const health = await this.analyticsService.checkMLServiceHealth();
      return {
        success: true,
        ml_service: health,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new HttpException(
        'ML service is not available',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  @Post('batch-student-risk')
  @Permissions('academic:supervision', 'reports:view')
  async analyzeBatchStudentRisk(@Body() batchData: { students: StudentRiskAnalysisDto[] }) {
    try {
      const results = await Promise.all(
        batchData.students.map(student => 
          this.analyticsService.analyzeStudentRisk(student)
        )
      );

      return {
        success: true,
        data: results.map((result, index) => ({
          ...result,
          student_id: batchData.students[index].student_id,
          timestamp: new Date().toISOString()
        }))
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Error en el análisis por lotes',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}