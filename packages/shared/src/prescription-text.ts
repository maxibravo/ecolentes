/**
 * Interpreta la graduación tal como la escriben los profesionales en la planilla:
 *
 *   LEJOS OD 180°-3,50 // OI 180°-2,75 - CERCA ADD+1,50 AO
 *
 * Las variantes son muchas (con eje y sin eje, uno o dos valores, NEUTRO como
 * valor válido), así que esto es una ayuda: lo que no se entiende queda en null
 * y se carga a mano. El texto original nunca se pierde.
 */
export type ParsedPrescription = {
  farRightSphere: number | null;
  farRightCylinder: number | null;
  farRightAxis: number | null;
  farLeftSphere: number | null;
  farLeftCylinder: number | null;
  farLeftAxis: number | null;
  nearAddition: number | null;
};

const EMPTY: ParsedPrescription = {
  farRightSphere: null,
  farRightCylinder: null,
  farRightAxis: null,
  farLeftSphere: null,
  farLeftCylinder: null,
  farLeftAxis: null,
  nearAddition: null,
};

/** "-3,50" y "+1.50" son números; "NEUTRO" es cero. */
function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const text = raw.trim();
  if (/^neutro$/i.test(text)) return 0;
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** De "180°-3,50" o "-0,25+0,50" saca eje, esfera y cilindro. */
function parseEye(raw: string): { sphere: number | null; cylinder: number | null; axis: number | null } {
  const text = raw.trim();
  if (/^neutro$/i.test(text)) return { sphere: 0, cylinder: null, axis: null };

  let rest = text;
  let axis: number | null = null;

  const axisMatch = rest.match(/^(\d{1,3})\s*°/);
  if (axisMatch?.[1]) {
    axis = Number(axisMatch[1]);
    rest = rest.slice(axisMatch[0].length);
  }

  // Los valores vienen pegados y con signo: "-0,25+0,50", "-3,50", "+2".
  const values = rest.match(/[+-]?\d+(?:[.,]\d+)?/g) ?? [];
  const sphere = toNumber(values[0]);
  const cylinder = toNumber(values[1]);

  return { sphere, cylinder, axis: axis !== null && axis >= 0 && axis <= 180 ? axis : null };
}

export function parsePrescription(rawText: string): ParsedPrescription {
  if (!rawText?.trim()) return { ...EMPTY };

  const text = rawText.replace(/\s+/g, ' ').trim();
  const result: ParsedPrescription = { ...EMPTY };

  const farPart = text.match(/LEJOS\s+(.*?)(?=\s*-?\s*CERCA|$)/i)?.[1] ?? '';
  if (farPart) {
    const right = farPart.match(/OD\s+([^/]+?)(?=\s*\/\/|$)/i)?.[1];
    const left = farPart.match(/OI\s+(.+?)$/i)?.[1];

    if (right) {
      const eye = parseEye(right);
      result.farRightSphere = eye.sphere;
      result.farRightCylinder = eye.cylinder;
      result.farRightAxis = eye.axis;
    }
    if (left) {
      const eye = parseEye(left.replace(/\s*-\s*$/, ''));
      result.farLeftSphere = eye.sphere;
      result.farLeftCylinder = eye.cylinder;
      result.farLeftAxis = eye.axis;
    }
  }

  const addition = text.match(/ADD\s*([+-]?\d+(?:[.,]\d+)?)/i)?.[1];
  result.nearAddition = toNumber(addition);

  return result;
}

/** Lejos y cerca son dos pares; sólo lejos, uno. */
export function pairsFromText(rawText: string): number {
  return /CERCA|ADD/i.test(rawText) ? 2 : 1;
}
