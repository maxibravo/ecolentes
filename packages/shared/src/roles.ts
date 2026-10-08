/** Roles del sistema. La etiqueta es lo que ve el usuario, en español. */
export const ROLES = {
  OPERATOR: 'Operador Ecolentes',
  OPHTHALMOLOGIST: 'Profesional oftalmólogo',
  OPTICIAN: 'Óptica',
  DIRECTOR: 'Dirección / aprobador',
  SOCIAL_DESK: 'Atención de consultas y redes',
  ADMIN: 'Administrador',
} as const;

export type Role = keyof typeof ROLES;
