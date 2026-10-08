/**
 * Las redes por las que escribe la gente. Sólo tiene sentido cuando el canal
 * de ingreso es "Redes sociales": sirve para saber por dónde responder.
 */
export const SOCIAL_NETWORKS = {
  WHATSAPP: 'WhatsApp',
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
} as const;

export type SocialNetwork = keyof typeof SOCIAL_NETWORKS;
