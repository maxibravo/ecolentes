/**
 * El DNI se escribe de muchas formas en papel (31.620.034, 31620034, con espacios).
 * Se guarda siempre como dígitos para que la búsqueda y el control de duplicados
 * no dependan de cómo lo tipeó cada persona.
 */
export function normalizeDni(input: string): string {
  return input.replace(/\D/g, '');
}

/** Los DNI argentinos vigentes tienen entre 7 y 8 dígitos. */
export function isValidDni(input: string): boolean {
  const digits = normalizeDni(input);
  return digits.length >= 7 && digits.length <= 8 && Number(digits) > 0;
}

/** Para mostrarlo como en la planilla: 31.620.034 */
export function formatDni(input: string): string {
  const digits = normalizeDni(input);
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
