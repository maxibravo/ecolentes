/**
 * Nadie escribe los acentos al buscar. "Juarez" tiene que encontrar a Juárez,
 * "ibanez" a Ibáñez y "pena" a Peña. Se guarda esta versión del nombre en la
 * ficha y se busca contra ella, en lugar de pedirle a quien atiende que tipee
 * el acento exacto. Las dos puntas pasan por acá, así que la búsqueda encuentra
 * lo mismo se escriba con tilde o sin tilde.
 */
export function searchText(...parts: (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(' ')
    .normalize('NFD')
    // Saca todo lo que sea tilde, diéresis o la virgulilla de la ñ.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
