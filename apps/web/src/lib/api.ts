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
};

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
