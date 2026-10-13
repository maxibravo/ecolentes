import {
  DEMO_CASES,
  DEMO_OPTICIAN,
  DEMO_PEOPLE,
  DEMO_USERS,
  glassesKindsFromText,
  pairsFromText,
  parsePrescription,
} from '@ecolentes/shared';
import type {
  CaseDetail,
  CaseEvent,
  CaseStage,
  Glasses,
  Person,
  Quote,
  Role,
  SessionUser,
  SocialNetwork,
} from '../lib/api';

/**
 * El estado de la versión de demostración: las mismas filas que carga el seed
 * de la base, armadas en memoria. Vive sólo en la pestaña, así que al recargar
 * vuelve todo al punto de partida.
 */
export type DemoPersonRecord = Person & { identityVerified: boolean };
export type DemoCaseRecord = Omit<CaseDetail, 'person'> & {
  person: DemoPersonRecord;
  socialNetwork: SocialNetwork | null;
  createdAt: string;
};

export type DemoState = {
  users: (SessionUser & { username: string; opticianId: string | null; active: boolean })[];
  people: DemoPersonRecord[];
  cases: DemoCaseRecord[];
  opticianId: string;
  opticianName: string;
  nextCode: number;
  /** El próximo número de anteojo. Va aparte del número de expediente. */
  nextGlassesCode: number;
};

const DAY = 86_400_000;

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * DAY).toISOString();
}

const PAST_APPROVAL: CaseStage[] = [
  'PRODUCTION',
  'RECEIVED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CLOSED',
];

/** Los decimales viajan como texto en la API real; acá se imita eso. */
function readPrescription(rawText: string, daysInStage: number) {
  const parsed = parsePrescription(rawText);
  const text = (value: number | null) => (value === null ? null : value.toFixed(2));
  return {
    rawText,
    farRightSphere: text(parsed.farRightSphere),
    farRightCylinder: text(parsed.farRightCylinder),
    farRightAxis: parsed.farRightAxis,
    farLeftSphere: text(parsed.farLeftSphere),
    farLeftCylinder: text(parsed.farLeftCylinder),
    farLeftAxis: parsed.farLeftAxis,
    nearAddition: text(parsed.nearAddition),
    validatedAt: daysAgoIso(daysInStage + 14),
  };
}

export function buildState(): DemoState {
  const opticianId = 'opt-1';

  // El administrador sale de DEMO_USERS como todos los demás, así que los datos
  // de ejemplo del navegador y los de la base dicen lo mismo.
  const users: DemoState['users'] = DEMO_USERS.map((u) => ({
    id: `u-${u.username}`,
    username: u.username,
    fullName: u.fullName,
    role: u.role as Role,
    opticianId: u.role === 'OPTICIAN' ? opticianId : null,
    active: true,
  }));

  const people: DemoPersonRecord[] = DEMO_PEOPLE.map((p) => ({
    id: `p-${p.dni}`,
    dni: p.dni,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate ?? null,
    ageAtIntake: null,
    ageTakenAt: null,
    sex: p.sex ?? null,
    phone: p.phone ?? null,
    address: null,
    neighborhood: p.neighborhood,
    representativeName: p.representativeName ?? null,
    representativePhone: null,
    representativeBond: p.representativeBond ?? null,
    notes: null,
    identityVerified: p.identityVerified ?? true,
    createdAt: daysAgoIso(60),
    updatedAt: daysAgoIso(60),
  }));

  // Los anteojos recién existen cuando Dirección aprueba la propuesta, así que
  // sólo los expedientes que pasaron por ahí tienen código de anteojo.
  let glassesCode = 0;

  const cases: DemoCaseRecord[] = DEMO_CASES.map((demo, i) => {
    const person = people.find((p) => p.dni === demo.dni)!;

    const quotes: Quote[] = (demo.quotes ?? []).map((q, v) => {
      const isLast = v === (demo.quotes?.length ?? 0) - 1;
      const approved = isLast && PAST_APPROVAL.includes(demo.stage);
      return {
        id: `q-${i}-${v}`,
        version: v + 1,
        lenses: q.lenses,
        frame: q.frame,
        leadDays: q.leadDays ?? null,
        amount: q.amount != null ? q.amount.toFixed(2) : null,
        notes: null,
        status: q.observedNote ? 'OBSERVED' : approved ? 'APPROVED' : 'SUBMITTED',
        decisionNote: q.observedNote ?? null,
        decidedAt: q.observedNote || approved ? daysAgoIso(demo.daysInStage + 6) : null,
        createdAt: daysAgoIso(demo.daysInStage + 8 - v),
      };
    });

    const events: CaseEvent[] = [
      {
        id: `e-${i}-0`,
        fromStage: null,
        toStage: 'REQUEST',
        hold: null,
        note: 'Solicitud cargada',
        username: 'operador',
        occurredAt: daysAgoIso(demo.daysInStage + 20),
      },
    ];
    if (demo.stage !== 'REQUEST') {
      events.push({
        id: `e-${i}-1`,
        fromStage: null,
        toStage: demo.stage,
        hold: null,
        note: demo.holdNote ?? null,
        username: 'operador',
        occurredAt: daysAgoIso(demo.daysInStage),
      });
    }

    const glasses: Glasses[] = PAST_APPROVAL.includes(demo.stage)
      ? glassesKindsFromText(demo.prescription ?? '').map((kind) => ({
          code: `ANT-${String(++glassesCode).padStart(4, '0')}`,
          kind,
          deliveredAt: demo.delivery ? daysAgoIso(demo.delivery.daysAgo) : null,
        }))
      : [];

    return {
      id: `c-${i}`,
      code: `ECO-${String(i + 1).padStart(4, '0')}`,
      stage: demo.stage,
      hold: demo.hold ?? null,
      holdNote: demo.holdNote ?? null,
      channel: demo.channel,
      socialNetwork: demo.socialNetwork ?? null,
      pairs: demo.prescription ? pairsFromText(demo.prescription) : 1,
      stageSince: daysAgoIso(demo.daysInStage),
      overdue: false,
      person,
      optician: { id: opticianId, name: DEMO_OPTICIAN.name },
      reason: demo.reason,
      prescription: demo.prescription ? readPrescription(demo.prescription, demo.daysInStage) : null,
      quotes: quotes.reverse(),
      glasses,
      delivery: demo.delivery
        ? {
            deliveredAt: daysAgoIso(demo.delivery.daysAgo),
            receivedBy: demo.delivery.receivedBy,
            receivedByDni: null,
            isRepresentative: demo.delivery.isRepresentative ?? false,
            note: null,
          }
        : null,
      events: events.reverse(),
      createdAt: daysAgoIso(demo.daysInStage + 20),
    };
  });

  return {
    users,
    people,
    cases,
    opticianId,
    opticianName: DEMO_OPTICIAN.name,
    nextCode: cases.length + 1,
    nextGlassesCode: glassesCode + 1,
  };
}
