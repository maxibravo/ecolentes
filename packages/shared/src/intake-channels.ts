/**
 * Por dónde entra un pedido. Las tres primeras son las vías que describió
 * el equipo de Salud; las demás vienen del relevamiento territorial.
 */
export const INTAKE_CHANNELS = {
  NEIGHBORHOOD_SURVEY: 'Relevamiento en barrio',
  COUNCIL_REQUEST: 'Pedido de concejales o legisladores',
  INDIVIDUAL_REQUEST: 'Pedido individual del vecino',
  TRAILER: 'Tráiler',
  CAC: 'CAC',
  SCHOOL: 'Escuela',
  SOCIAL_MEDIA: 'Redes sociales',
  PUBLIC_FORM: 'Formulario público',
} as const;

export type IntakeChannel = keyof typeof INTAKE_CHANNELS;
