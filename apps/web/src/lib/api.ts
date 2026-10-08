export type Role =
  | 'OPERATOR'
  | 'OPHTHALMOLOGIST'
  | 'OPTICIAN'
  | 'DIRECTOR'
  | 'SOCIAL_DESK'
  | 'ADMIN';

export type SessionUser = { id: string; username: string; fullName: string; role: Role };

export type Person = {
  id: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  ageAtIntake: number | null;
  sex: 'FEMENINO' | 'MASCULINO' | 'OTRO' | null;
  phone: string | null;
  address: string | null;
  neighborhood: string | null;
  representativeName: string | null;
  representativePhone: string | null;
  representativeBond: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'LOGIN' | 'LOGIN_FAILED';
  username: string | null;
  changes: Record<string, { de: unknown; a: unknown }> | null;
  occurredAt: string;
};

export type CaseStage =
  | 'REQUEST'
  | 'ASSESSMENT'
  | 'OPTICIAN_QUOTE'
  | 'APPROVAL'
  | 'PRODUCTION'
  | 'RECEIVED'
  | 'READY_FOR_PICKUP'
  | 'DELIVERED'
  | 'CLOSED';

export type CaseHold =
  | 'MISSING_DOCUMENTS'
  | 'QUOTE_OBSERVED'
  | 'REJECTED'
  | 'DELAYED'
  | 'NOT_LOCATED'
  | 'WITHDRAWN'
  | 'COMPLAINT';

export type IntakeChannel =
  | 'NEIGHBORHOOD_SURVEY'
  | 'COUNCIL_REQUEST'
  | 'INDIVIDUAL_REQUEST'
  | 'TRAILER'
  | 'CAC'
  | 'SCHOOL'
  | 'SOCIAL_MEDIA'
  | 'PUBLIC_FORM';

export type Quote = {
  id: string;
  version: number;
  lenses: string;
  frame: string;
  leadDays: number | null;
  amount: string | null;
  notes: string | null;
  status: 'SUBMITTED' | 'APPROVED' | 'OBSERVED';
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type Prescription = {
  rawText: string;
  farRightSphere: string | null;
  farRightCylinder: string | null;
  farRightAxis: number | null;
  farLeftSphere: string | null;
  farLeftCylinder: string | null;
  farLeftAxis: number | null;
  nearAddition: string | null;
  validatedAt: string | null;
};

export type CaseEvent = {
  id: string;
  fromStage: CaseStage | null;
  toStage: CaseStage | null;
  hold: CaseHold | null;
  note: string | null;
  username: string | null;
  occurredAt: string;
};

export type CaseSummary = {
  id: string;
  code: string;
  stage: CaseStage;
  hold: CaseHold | null;
  holdNote: string | null;
  channel: IntakeChannel;
  pairs: number;
  stageSince: string;
  overdue: boolean;
  person: Person;
  optician: { id: string; name: string } | null;
};

export type CaseDetail = CaseSummary & {
  reason: string | null;
  prescription: Prescription | null;
  quotes: Quote[];
  delivery: {
    deliveredAt: string;
    receivedBy: string;
    isRepresentative: boolean;
    note: string | null;
  } | null;
  events: CaseEvent[];
};

export type Optician = { id: string; name: string };

const TOKEN_KEY = 'ecolentes.token';

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Sin almacenamiento la sesión dura lo que dure la pestaña.
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readToken();
  const response = await fetch(`/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (body as { message?: string | string[] } | null)?.message ?? 'No se pudo completar la acción';
    throw new ApiError(Array.isArray(message) ? message[0]! : message, response.status, body);
  }

  return body as T;
}

export const api = {
  login(username: string, password: string) {
    return request<{ accessToken: string; user: SessionUser; mustChangePassword: boolean }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
    );
  },
  searchPeople(q: string) {
    return request<Person[]>(`/personas?q=${encodeURIComponent(q)}`);
  },
  personByDni(dni: string) {
    return request<Person>(`/personas/por-dni/${encodeURIComponent(dni)}`);
  },
  person(id: string) {
    return request<Person>(`/personas/${id}`);
  },
  personHistory(id: string) {
    return request<AuditEntry[]>(`/personas/${id}/historial`);
  },
  createPerson(input: Partial<Person> & { dni: string; firstName: string; lastName: string }) {
    return request<Person>('/personas', { method: 'POST', body: JSON.stringify(input) });
  },

  listCases(params: {
    stage?: CaseStage | '';
    q?: string;
    neighborhood?: string;
    overdue?: boolean;
  }) {
    const search = new URLSearchParams();
    if (params.stage) search.set('stage', params.stage);
    if (params.q) search.set('q', params.q);
    if (params.neighborhood) search.set('neighborhood', params.neighborhood);
    if (params.overdue) search.set('overdue', 'true');
    return request<CaseSummary[]>(`/expedientes?${search.toString()}`);
  },
  case(id: string) {
    return request<CaseDetail>(`/expedientes/${id}`);
  },
  createCase(input: { personId: string; channel: IntakeChannel; reason?: string }) {
    return request<CaseSummary>('/expedientes', { method: 'POST', body: JSON.stringify(input) });
  },
  assignOptician(id: string, opticianId: string) {
    return request<CaseSummary>(`/expedientes/${id}/optica`, {
      method: 'PATCH',
      body: JSON.stringify({ opticianId }),
    });
  },
  setPrescription(id: string, rawText: string) {
    return request<Prescription>(`/expedientes/${id}/receta`, {
      method: 'POST',
      body: JSON.stringify({ rawText }),
    });
  },
  submitQuote(
    id: string,
    input: { lenses: string; frame: string; leadDays?: number; amount?: number; notes?: string },
  ) {
    return request<Quote>(`/expedientes/${id}/propuesta`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  decideQuote(id: string, approve: boolean, note?: string) {
    return request<CaseSummary>(`/expedientes/${id}/aprobacion`, {
      method: 'POST',
      body: JSON.stringify({ approve, note }),
    });
  },
  moveStage(id: string, to: CaseStage, note?: string) {
    return request<CaseSummary>(`/expedientes/${id}/etapa`, {
      method: 'PATCH',
      body: JSON.stringify({ to, note }),
    });
  },
  registerDelivery(
    id: string,
    input: { deliveredAt: string; receivedBy: string; isRepresentative?: boolean },
  ) {
    return request<unknown>(`/expedientes/${id}/entrega`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  setHold(id: string, hold: CaseHold, note?: string) {
    return request<CaseSummary>(`/expedientes/${id}/freno`, {
      method: 'PATCH',
      body: JSON.stringify({ hold, note }),
    });
  },
};

export const STAGE_LABELS: Record<CaseStage, string> = {
  REQUEST: 'Solicitud',
  ASSESSMENT: 'Evaluación y receta',
  OPTICIAN_QUOTE: 'Propuesta óptica',
  APPROVAL: 'Aprobación',
  PRODUCTION: 'Producción',
  RECEIVED: 'Recepción municipal',
  READY_FOR_PICKUP: 'Para entregar',
  DELIVERED: 'Entregado',
  CLOSED: 'Cerrado',
};

export const HOLD_LABELS: Record<CaseHold, string> = {
  MISSING_DOCUMENTS: 'Falta documentación',
  QUOTE_OBSERVED: 'Propuesta observada',
  REJECTED: 'Rechazado',
  DELAYED: 'Demorado',
  NOT_LOCATED: 'No se pudo ubicar a la persona',
  WITHDRAWN: 'Desistió',
  COMPLAINT: 'Reclamo',
};

export const CHANNEL_LABELS: Record<IntakeChannel, string> = {
  NEIGHBORHOOD_SURVEY: 'Relevamiento en barrio',
  COUNCIL_REQUEST: 'Pedido de concejales o legisladores',
  INDIVIDUAL_REQUEST: 'Pedido individual del vecino',
  TRAILER: 'Tráiler',
  CAC: 'CAC',
  SCHOOL: 'Escuela',
  SOCIAL_MEDIA: 'Redes sociales',
  PUBLIC_FORM: 'Formulario público',
};

/** Días desde que el expediente entró en la etapa actual. */
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** 31620034 se muestra 31.620.034, como en la planilla. */
export function formatDni(dni: string): string {
  return dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export const ROLE_LABELS: Record<Role, string> = {
  OPERATOR: 'Operador Ecolentes',
  OPHTHALMOLOGIST: 'Profesional oftalmólogo',
  OPTICIAN: 'Óptica',
  DIRECTOR: 'Dirección',
  SOCIAL_DESK: 'Atención de consultas y redes',
  ADMIN: 'Administrador',
};
