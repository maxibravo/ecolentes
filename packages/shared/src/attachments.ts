import type { Role } from './roles.js';

/** Qué es la imagen cargada. De esto depende quién puede verla. */
export const ATTACHMENT_KINDS = {
  DNI_FRONT: 'DNI, frente',
  DNI_BACK: 'DNI, dorso',
  PRESCRIPTION: 'Receta del oftalmólogo',
} as const;

export type AttachmentKind = keyof typeof ATTACHMENT_KINDS;

/** Las fotos del DNI son de la persona; la receta, del expediente. */
export function attachmentBelongsToPerson(kind: AttachmentKind): boolean {
  return kind === 'DNI_FRONT' || kind === 'DNI_BACK';
}

/**
 * Quién puede ver cada imagen, con el mismo criterio que el resto del sistema:
 * cada rol ve lo que necesita para su parte y nada más.
 *
 * La foto del DNI la ven los que atienden a la persona y verifican su
 * identidad. Dirección aprueba sin saber de quién se trata y la óptica trabaja
 * con la graduación, así que para ellos no existe.
 *
 * La receta la ve además la óptica, que es la que fabrica los anteojos con
 * esa graduación. Dirección queda afuera también acá, porque la receta suele
 * tener escrito el nombre de la persona.
 */
export const ATTACHMENT_VIEWERS: Record<AttachmentKind, Role[]> = {
  DNI_FRONT: ['OPERATOR', 'SOCIAL_DESK', 'ADMIN'],
  DNI_BACK: ['OPERATOR', 'SOCIAL_DESK', 'ADMIN'],
  PRESCRIPTION: ['OPERATOR', 'OPHTHALMOLOGIST', 'OPTICIAN', 'SOCIAL_DESK', 'ADMIN'],
};

export function seesAttachment(role: Role, kind: AttachmentKind): boolean {
  return ATTACHMENT_VIEWERS[kind].includes(role);
}

/** Quién puede cargar cada imagen: los mismos que la ven, salvo la óptica. */
export function canUploadAttachment(role: Role, kind: AttachmentKind): boolean {
  return seesAttachment(role, kind) && role !== 'OPTICIAN';
}

/** Formatos que acepta el sistema. Es lo que sale de la cámara del teléfono. */
export const ATTACHMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/**
 * Tamaño máximo de una imagen ya guardada. La pantalla achica la foto antes de
 * mandarla, así que esto es el tope de lo que llega, no lo que se espera: una
 * foto de 4 megapíxeles del teléfono entra holgada después de achicarse.
 */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
