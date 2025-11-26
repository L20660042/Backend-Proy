import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

interface StudentRiskData {
  grades: number[];
  attendance: number[];
  tutoring_sessions: number;
  evaluation_scores: number[];
}

interface FeedbackData {
  text: string;
  context?: string;
}

interface RiskAnalysisResult {
  risk_level: string;
  confidence: number;
  risk_factors: string[];
  recommendations: string[];
}

interface SentimentAnalysisResult {
  sentiment: string;
  confidence: number;
  key_phrases: string[];
  urgency_level: string;
}

@Injectable()
export class AnalyticsService {
  private readonly mlServiceUrl = 'https://ml-service-production-fff9.up.railway.app';

  constructor(private readonly httpService: HttpService) {}

  async analyzeStudentRisk(studentData: StudentRiskData): Promise<RiskAnalysisResult> {
    try {
      const response: AxiosResponse<RiskAnalysisResult> = await firstValueFrom(
        this.httpService.post(`${this.mlServiceUrl}/api/analyze/student-risk`, studentData)
      );

      return response.data;
    } catch (error) {
      console.error('Error calling ML service for risk analysis:', error);
      
      // Fallback a análisis local si el servicio ML falla
      return this.fallbackRiskAnalysis(studentData);
    }
  }

  async analyzeFeedbackSentiment(feedbackData: FeedbackData): Promise<SentimentAnalysisResult> {
    try {
      const response: AxiosResponse<SentimentAnalysisResult> = await firstValueFrom(
        this.httpService.post(`${this.mlServiceUrl}/api/analyze/feedback-sentiment`, feedbackData)
      );

      return response.data;
    } catch (error) {
      console.error('Error calling ML service for sentiment analysis:', error);
      
      // Fallback a análisis local
      return this.fallbackSentimentAnalysis(feedbackData.text);
    }
  }

  async checkMLServiceHealth(): Promise<{ status: string; service: string }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.mlServiceUrl}/api/health`)
      );
      return response.data;
    } catch (error) {
      throw new HttpException(
        'ML service is not available',
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  private fallbackRiskAnalysis(studentData: StudentRiskData): RiskAnalysisResult {
    // Lógica de fallback simple basada en reglas
    const avgGrade = studentData.grades.reduce((a, b) => a + b, 0) / studentData.grades.length;
    const avgAttendance = studentData.attendance.reduce((a, b) => a + b, 0) / studentData.attendance.length;
    
    let riskLevel = 'bajo';
    let confidence = 0.7;
    const riskFactors: string[] = [];
    
    if (avgGrade < 60) {
      riskLevel = 'alto';
      riskFactors.push('calificaciones_bajas');
    } else if (avgGrade < 70) {
      riskLevel = 'medio';
      riskFactors.push('calificaciones_medias');
    }
    
    if (avgAttendance < 70) {
      riskLevel = riskLevel === 'bajo' ? 'medio' : 'alto';
      riskFactors.push('asistencia_baja');
    }
    
    if (studentData.tutoring_sessions > 5) {
      riskFactors.push('multiple_tutorias');
    }

    return {
      risk_level: riskLevel,
      confidence,
      risk_factors: riskFactors,
      recommendations: this.getFallbackRecommendations(riskLevel, riskFactors)
    };
  }

  private fallbackSentimentAnalysis(text: string): SentimentAnalysisResult {
    // Análisis de sentimiento simple basado en palabras clave
    const positiveWords = ['excelente', 'bueno', 'genial', 'perfecto', 'claro', 'entendí', 'gracias'];
    const negativeWords = ['problema', 'difícil', 'confuso', 'malo', 'horrible', 'terrible', 'no entiendo'];
    const urgentWords = ['urgente', 'emergencia', 'ayuda', 'desesperado', 'frustrado'];
    
    const textLower = text.toLowerCase();
    
    const positiveCount = positiveWords.filter(word => textLower.includes(word)).length;
    const negativeCount = negativeWords.filter(word => textLower.includes(word)).length;
    const urgentCount = urgentWords.filter(word => textLower.includes(word)).length;
    
    let sentiment = 'neutral';
    let confidence = 0.5;
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      confidence = 0.7 + (positiveCount * 0.1);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      confidence = 0.7 + (negativeCount * 0.1);
    }
    
    let urgency_level = 'low';
    if (urgentCount > 0) {
      urgency_level = 'high';
    } else if (negativeCount > 2) {
      urgency_level = 'medium';
    }
    
    return {
      sentiment,
      confidence: Math.min(confidence, 0.95),
      key_phrases: [text.substring(0, 100)],
      urgency_level
    };
  }

  private getFallbackRecommendations(riskLevel: string, factors: string[]): string[] {
    const recommendations = {
      bajo: [
        'Continuar con el buen desempeño actual',
        'Mantener participación activa en clase'
      ],
      medio: [
        'Reforzar temas con dificultad identificada',
        'Incrementar horas de estudio en áreas débiles',
        'Participar en tutorías preventivas'
      ],
      alto: [
        'Plan de intervención académica inmediata',
        'Tutorías intensivas',
        'Reunión con coordinador académico'
      ]
    };
    
    return recommendations[riskLevel] || ['Seguimiento general'];
  }
}