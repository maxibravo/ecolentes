/**
 * Etapas del expediente, en el orden confirmado con Salud el 2026-10-08.
 * Medio Ambiente no interviene en el circuito.
 */
export const CASE_STAGES = [
  { key: 'REQUEST', label: 'Solicitud' },
  { key: 'ASSESSMENT', label: 'Evaluación y receta' },
  { key: 'OPTICIAN_QUOTE', label: 'Propuesta óptica' },
  { key: 'APPROVAL', label: 'Aprobación' },
  { key: 'PRODUCTION', label: 'Producción' },
  { key: 'RECEIVED', label: 'Recepción municipal' },
  { key: 'READY_FOR_PICKUP', label: 'Para entregar' },
  { key: 'DELIVERED', label: 'Entregado' },
  { key: 'CLOSED', label: 'Cerrado' },
] as const;

export type CaseStage = (typeof CASE_STAGES)[number]['key'];

export const CASE_STAGE_LABELS = Object.fromEntries(
  CASE_STAGES.map((s) => [s.key, s.label]),
) as Record<CaseStage, string>;
