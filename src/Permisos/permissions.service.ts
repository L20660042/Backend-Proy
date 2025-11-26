import { Injectable } from '@nestjs/common';

@Injectable()
export class PermissionsService {
  private readonly rolePermissions = {
    'administrador-general': [
      'system:config',
      'system:control',
      'users:manage',
      'institutions:manage',
      'departments:manage',
      'groups:manage',
      'teachers:manage',
      'tutors:manage',
      'academic:supervision',
      'reports:view'
    ],
    'jefe-departamento': [
      'groups:manage',
      'teachers:manage',
      'academic:supervision',
      'reports:view'
    ],
    'docente': [
      'teaching:execute',
      'evaluation:execute',
      'grades:manage',
      'attendance:record'
    ],
    'tutor': [
      'students:follow',
      'personalized:tracking',
      'reports:generate'
    ],
    'coordinador-tutorias': [
      'tutoring:program:manage',
      'tutors:coordinate',
      'reports:view'
    ],
    'control-escolar': [
      'academic:integrity',
      'records:manage',
      'certifications:issue'
    ],
    'subdireccion-academica': [
      'academic:supervision',
      'strategic:planning',
      'reports:view',
      'institutions:oversee'
    ]
  };

  getPermissionsForRole(role: string): string[] {
    return this.rolePermissions[role] || [];
  }

  hasPermission(userPermissions: string[], requiredPermission: string): boolean {
    return userPermissions.includes(requiredPermission);
  }

  getUserPermissions(userType: string): string[] {
    return this.getPermissionsForRole(userType);
  }
}