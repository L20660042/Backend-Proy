/** Roles de usuario para todo el sistema */
export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  JEFE_DEPARTAMENTO = 'jefe_departamento',
  DOCENTE = 'docente',
  TUTOR = 'tutor',
  CAPACITACION = 'capacitacion',
  CONTROL_ESCOLAR = 'control_escolar',
  ESTUDIANTE = 'estudiante',
}

/** Estados de activación o estatus */
export enum Status {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}
