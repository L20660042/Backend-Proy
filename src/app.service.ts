import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Sistema de Gestión Académica - API';
  }

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  getSystemInfo(): any {
    return {
      name: 'Sistema de Gestión Académica',
      version: '1.0.0',
      description: 'Sistema integral para gestión de instituciones educativas',
      modules: [
        'Autenticación y Usuarios',
        'Gestión de Instituciones',
        'Gestión de Materias',
        'Gestión de Grupos',
        'Gestión de Calificaciones',
        'Sistema de Quejas y Evaluaciones'
      ],
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }

  // Método para obtener estadísticas generales del sistema
  async getSystemStats(): Promise<any> {
    // En una implementación real, aquí conectarías con los otros servicios
    // para obtener estadísticas consolidadas
    return {
      totalModules: 6,
      active: true,
      features: [
        'Gestión de usuarios multi-rol',
        'Control de instituciones educativas',
        'Sistema de calificaciones',
        'Evaluaciones docentes',
        'Reportes académicos',
        'Sistema de quejas y sugerencias'
      ]
    };
  }
}