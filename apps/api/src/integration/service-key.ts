import { randomBytes } from 'node:crypto';

/**
 * La clave que usa un sistema para consultar la API. Se arma como
 * `eco_<prefijo>_<secreto>`: el prefijo se guarda en claro para poder
 * reconocer la credencial en una lista, y el secreto no se guarda nunca.
 */
export const KEY_PREFIX_LENGTH = 12;

export function generateServiceKey(): { key: string; prefix: string; secret: string } {
  // El prefijo va en hexadecimal a propósito: base64url trae guiones bajos, y
  // un guión bajo adentro del prefijo rompe el corte que hace parseServiceKey.
  const prefix = randomBytes(KEY_PREFIX_LENGTH / 2).toString('hex');
  const secret = randomBytes(32).toString('base64url');
  return { key: `eco_${prefix}_${secret}`, prefix, secret };
}

/**
 * Parte una clave recibida en prefijo y secreto. Devuelve null si no tiene la
 * forma esperada, así el guardia contesta lo mismo que ante una clave inventada.
 */
export function parseServiceKey(key: string): { prefix: string; secret: string } | null {
  const [marca, prefix, ...resto] = key.split('_');
  // El secreto es base64url y puede tener guiones bajos, así que todo lo que
  // viene después del prefijo es el secreto, no un separador más.
  const secret = resto.join('_');
  if (marca !== 'eco' || !prefix || !secret) return null;
  return { prefix, secret };
}
