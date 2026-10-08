import type { Role } from './roles.js';

/**
 * Roles que pueden ver reportes con nombre y DNI. Dirección aprueba y mide sin
 * ver la identidad, y la óptica no entra a los reportes. Lo que queda afuera
 * no se tacha en el navegador: la API no lo manda.
 */
export const NOMINAL_REPORT_ROLES: Role[] = ['OPERATOR', 'OPHTHALMOLOGIST', 'SOCIAL_DESK', 'ADMIN'];

export function seesIdentityInReports(role: Role): boolean {
  return NOMINAL_REPORT_ROLES.includes(role);
}

/**
 * Mínimo de casos que tiene que tener un grupo para publicar su número cuando
 * el reporte sale del sistema. En un barrio chico, "1 entregado" alcanza para
 * saber de quién se habla.
 */
export const SMALL_CELL_THRESHOLD = 3;

/** Devuelve null cuando el número es tan chico que identifica a una persona. */
export function suppressSmallCell(count: number): number | null {
  return count > 0 && count < SMALL_CELL_THRESHOLD ? null : count;
}
