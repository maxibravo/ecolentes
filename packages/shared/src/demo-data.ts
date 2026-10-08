/**
 * Datos de ejemplo para mostrar el sistema funcionando: barrios reales de San
 * Miguel de Tucumán y personas, DNI, teléfonos y graduaciones **inventados**.
 * Ninguna fila sale de una planilla real. Viven acá, en un solo lugar, para que
 * el seed de la base y la versión de demostración muestren lo mismo.
 */
import type { CaseStage } from './case-stages.js';
import type { IntakeChannel } from './intake-channels.js';
import type { SocialNetwork } from './social-networks.js';

export type DemoPerson = {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate?: string;
  sex?: 'FEMENINO' | 'MASCULINO';
  phone?: string;
  neighborhood: string;
  identityVerified?: boolean;
  representativeName?: string;
  representativeBond?: string;
};

export type DemoCase = {
  dni: string;
  stage: CaseStage;
  /** Días que lleva en la etapa actual. Es lo que hace aparecer las demoras. */
  daysInStage: number;
  channel: IntakeChannel;
  socialNetwork?: SocialNetwork;
  operation?: string;
  reason: string;
  hold?: 'MISSING_DOCUMENTS' | 'QUOTE_OBSERVED' | 'DELAYED' | 'NOT_LOCATED' | 'COMPLAINT';
  holdNote?: string;
  prescription?: string;
  /** Cada versión de la propuesta de la óptica, de la primera a la última. */
  quotes?: { lenses: string; frame: string; leadDays?: number; amount?: number; observedNote?: string }[];
  delivery?: { daysAgo: number; receivedBy: string; isRepresentative?: boolean };
};

export const DEMO_OPTICIAN = {
  name: 'Óptica Centro',
  phone: '381 400-1188',
  address: 'San Martín 450',
};

export const DEMO_OPERATIONS = [
  { name: 'Tráiler Salud de la Mujer · Villa Alem', daysAgo: 12 },
  { name: 'Tráiler Pediátrico · Barrio Sur', daysAgo: 26 },
  { name: 'CAC Norte', daysAgo: 40 },
  { name: 'Recorrida B° 360 Viviendas', daysAgo: 54 },
];

export const DEMO_USERS = [
  { username: 'operador', fullName: 'Carolina Suárez', role: 'OPERATOR' as const },
  { username: 'oftalmologo', fullName: 'Dr. Hernán Paz', role: 'OPHTHALMOLOGIST' as const },
  { username: 'optica', fullName: 'Óptica Centro · Mesa de pedidos', role: 'OPTICIAN' as const },
  { username: 'direccion', fullName: 'Mariela Ocampo', role: 'DIRECTOR' as const },
  { username: 'redes', fullName: 'Lucas Gramajo', role: 'SOCIAL_DESK' as const },
];

export const DEMO_PEOPLE: DemoPerson[] = [
  { dni: '31620034', firstName: 'Mirta Elena', lastName: 'Juárez', birthDate: '1984-03-11', sex: 'FEMENINO', phone: '381 511-2043', neighborhood: 'Villa 9 de Julio' },
  { dni: '28904117', firstName: 'Ramón Alberto', lastName: 'Medina', birthDate: '1977-09-02', sex: 'MASCULINO', phone: '381 544-8810', neighborhood: 'Barrio Sur' },
  { dni: '40338216', firstName: 'Lucía', lastName: 'Fernández', birthDate: '1996-12-19', sex: 'FEMENINO', phone: '381 598-3372', neighborhood: 'Barrio Sur' },
  { dni: '35661008', firstName: 'Ana Belén', lastName: 'Toledo', birthDate: '1991-06-30', sex: 'FEMENINO', phone: '381 507-7765', neighborhood: 'Villa 9 de Julio' },
  { dni: '24118756', firstName: 'Olga Rosa', lastName: 'Ibáñez', birthDate: '1969-01-24', sex: 'FEMENINO', phone: '381 522-0914', neighborhood: 'Villa Alem' },
  { dni: '47220185', firstName: 'Thiago', lastName: 'Villagra', birthDate: '2015-08-07', sex: 'MASCULINO', neighborhood: 'Barrio Sur', representativeName: 'Daniela Villagra', representativeBond: 'Madre' },
  { dni: '33047592', firstName: 'Patricia', lastName: 'Coronel', birthDate: '1987-11-05', sex: 'FEMENINO', phone: '381 566-1120', neighborhood: 'B° 360 Viviendas' },
  { dni: '20774631', firstName: 'Héctor Daniel', lastName: 'Ávila', birthDate: '1963-04-17', sex: 'MASCULINO', phone: '381 533-9067', neighborhood: 'San Cayetano' },
  { dni: '42905318', firstName: 'Brenda', lastName: 'Sosa', birthDate: '2000-02-28', sex: 'FEMENINO', phone: '381 587-4451', neighborhood: 'Villa Amalia' },
  { dni: '26551903', firstName: 'Juan Carlos', lastName: 'Ledesma', birthDate: '1974-07-21', sex: 'MASCULINO', phone: '381 519-6682', neighborhood: 'Villa Angelina' },
  { dni: '38112470', firstName: 'Noelia', lastName: 'Quiroga', birthDate: '1993-10-09', sex: 'FEMENINO', phone: '381 573-2298', neighborhood: 'Barrio Echeverría' },
  { dni: '19483006', firstName: 'Rosa Amalia', lastName: 'Cabrera', birthDate: '1961-05-13', sex: 'FEMENINO', phone: '381 540-7719', neighborhood: 'Villa 9 de Julio' },
  { dni: '45330821', firstName: 'Camila', lastName: 'Figueroa', birthDate: '2007-01-30', sex: 'FEMENINO', neighborhood: 'B° 360 Viviendas', representativeName: 'Silvia Figueroa', representativeBond: 'Madre' },
  // Entró por el formulario público: nadie la vio todavía.
  { dni: '36998214', firstName: 'Gabriel', lastName: 'Romano', phone: '381 505-3341', neighborhood: 'Barrio Policial', identityVerified: false },
];

export const DEMO_CASES: DemoCase[] = [
  {
    dni: '31620034', stage: 'DELIVERED', daysInStage: 9, channel: 'NEIGHBORHOOD_SURVEY',
    operation: 'Recorrida B° 360 Viviendas', reason: 'No ve de lejos y trabaja cosiendo',
    prescription: 'LEJOS OD 180°-3,50 // OI 180°-2,75 - CERCA ADD+1,50 AO',
    quotes: [{ lenses: 'Orgánicos AR bifocales', frame: 'Acetato liviano', leadDays: 12, amount: 42000 }],
    delivery: { daysAgo: 9, receivedBy: 'Mirta Elena Juárez' },
  },
  {
    dni: '28904117', stage: 'CLOSED', daysInStage: 31, channel: 'TRAILER',
    operation: 'Tráiler Pediátrico · Barrio Sur', reason: 'Dolor de cabeza al leer',
    prescription: 'LEJOS OD NEUTRO // OI NEUTRO - CERCA ADD+2,00 AO',
    quotes: [{ lenses: 'Orgánicos para cerca', frame: 'Metal rectangular', leadDays: 10, amount: 28500 }],
    delivery: { daysAgo: 38, receivedBy: 'Ramón Alberto Medina' },
  },
  {
    dni: '24118756', stage: 'DELIVERED', daysInStage: 3, channel: 'CAC', operation: 'CAC Norte',
    reason: 'Cataratas operadas, necesita anteojos nuevos',
    prescription: 'LEJOS OD 90°-1,25 // OI 90°-1,50 - CERCA ADD+2,25 AO',
    quotes: [
      { lenses: 'Multifocales', frame: 'Acetato grande', leadDays: 20, amount: 68000, observedNote: 'Multifocal no está previsto en el programa, cotizar bifocal' },
      { lenses: 'Bifocales AR', frame: 'Acetato grande', leadDays: 14, amount: 46000 },
    ],
    delivery: { daysAgo: 3, receivedBy: 'Olga Rosa Ibáñez' },
  },
  {
    dni: '47220185', stage: 'READY_FOR_PICKUP', daysInStage: 14, channel: 'SCHOOL',
    reason: 'La maestra avisó que no ve el pizarrón',
    prescription: 'LEJOS OD 10°-1,75 // OI 170°-2,00',
    quotes: [{ lenses: 'Policarbonato infantil', frame: 'Flexible infantil', leadDays: 15, amount: 39000 }],
    hold: 'NOT_LOCATED', holdNote: 'El teléfono de la madre da apagado desde el lunes',
  },
  {
    dni: '33047592', stage: 'READY_FOR_PICKUP', daysInStage: 4, channel: 'NEIGHBORHOOD_SURVEY',
    operation: 'Recorrida B° 360 Viviendas', reason: 'Ve nublado de un ojo',
    prescription: 'LEJOS OD 180°-4,00 // OI 180°-3,25',
    quotes: [{ lenses: 'Orgánicos AR', frame: 'Metal liviano', leadDays: 12, amount: 41000 }],
  },
  {
    dni: '45330821', stage: 'RECEIVED', daysInStage: 6, channel: 'SCHOOL',
    reason: 'Control escolar: miopía',
    prescription: 'LEJOS OD 180°-2,25 // OI 180°-2,50',
    quotes: [{ lenses: 'Orgánicos AR', frame: 'Acetato juvenil', leadDays: 12, amount: 37500 }],
  },
  {
    dni: '20774631', stage: 'PRODUCTION', daysInStage: 19, channel: 'INDIVIDUAL_REQUEST',
    reason: 'Es diabético y le cuesta leer los remedios',
    prescription: 'LEJOS OD 90°-2,00 // OI 90°-2,00 - CERCA ADD+2,50 AO',
    quotes: [{ lenses: 'Bifocales AR', frame: 'Metal clásico', leadDays: 15, amount: 44000 }],
  },
  {
    dni: '26551903', stage: 'PRODUCTION', daysInStage: 8, channel: 'COUNCIL_REQUEST',
    reason: 'Pedido del concejal Ríos por un vecino del barrio',
    prescription: 'LEJOS OD 180°-1,50 // OI 180°-1,25 - CERCA ADD+1,75 AO',
    quotes: [{ lenses: 'Bifocales', frame: 'Acetato oscuro', leadDays: 12, amount: 40000 }],
  },
  {
    dni: '19483006', stage: 'APPROVAL', daysInStage: 5, channel: 'CAC', operation: 'CAC Norte',
    reason: 'Perdió los anteojos y no puede reponerlos',
    prescription: 'LEJOS OD 90°-3,00 // OI 90°-3,50 - CERCA ADD+2,00 AO',
    quotes: [{ lenses: 'Bifocales AR', frame: 'Acetato liviano', leadDays: 14, amount: 45500 }],
  },
  {
    dni: '38112470', stage: 'OPTICIAN_QUOTE', daysInStage: 7, channel: 'TRAILER',
    operation: 'Tráiler Salud de la Mujer · Villa Alem', reason: 'Astigmatismo, le molesta la luz',
    prescription: 'LEJOS OD 20°-1,00 // OI 160°-1,25',
    hold: 'QUOTE_OBSERVED', holdNote: 'Dirección pidió cotizar un armazón del programa',
    quotes: [{ lenses: 'Orgánicos AR', frame: 'Armazón de diseño', leadDays: 18, amount: 72000, observedNote: 'Dirección pidió cotizar un armazón del programa' }],
  },
  {
    dni: '42905318', stage: 'OPTICIAN_QUOTE', daysInStage: 2, channel: 'TRAILER',
    operation: 'Tráiler Salud de la Mujer · Villa Alem', reason: 'Estudia de noche y no ve el pizarrón',
    prescription: 'LEJOS OD 180°-2,75 // OI 180°-3,00',
  },
  {
    dni: '40338216', stage: 'ASSESSMENT', daysInStage: 17, channel: 'SOCIAL_MEDIA',
    socialNetwork: 'INSTAGRAM', reason: 'Escribió por Instagram: no puede pagar los anteojos que le recetaron',
    hold: 'DELAYED', holdNote: 'Falta turno con el oftalmólogo',
  },
  {
    dni: '35661008', stage: 'ASSESSMENT', daysInStage: 3, channel: 'SOCIAL_MEDIA',
    socialNetwork: 'WHATSAPP', reason: 'Consulta por WhatsApp: dolor de cabeza al leer',
  },
  {
    dni: '36998214', stage: 'REQUEST', daysInStage: 2, channel: 'PUBLIC_FORM',
    reason: 'Completó el formulario: ve borroso de lejos desde hace meses',
  },
  {
    dni: '31620034', stage: 'REQUEST', daysInStage: 11, channel: 'INDIVIDUAL_REQUEST',
    reason: 'Volvió a pedir: se le rompió un cristal',
    hold: 'MISSING_DOCUMENTS', holdNote: 'Falta la constancia de domicilio',
  },
  {
    dni: '28904117', stage: 'REQUEST', daysInStage: 1, channel: 'SOCIAL_MEDIA',
    socialNetwork: 'FACEBOOK', reason: 'Escribió por Facebook preguntando por un recambio',
  },
];
