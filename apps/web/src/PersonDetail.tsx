import { useEffect, useState } from 'react';
import {
  api,
  daysSince,
  formatDni,
  HOLD_LABELS,
  STAGE_LABELS,
  type AuditEntry,
  type CaseSummary,
  type Person,
  type Role,
} from './lib/api';

const ACTION_LABELS: Record<AuditEntry['action'], string> = {
  VIEW: 'Vio la ficha',
  CREATE: 'Creó la ficha',
  UPDATE: 'Modificó la ficha',
  LOGIN: 'Inició sesión',
  LOGIN_FAILED: 'Intento de ingreso fallido',
};

export function PersonDetail({
  id,
  role,
  onBack,
  onOpenCase,
}: {
  id: string;
  role: Role;
  onBack: () => void;
  onOpenCase: (id: string) => void;
}) {
  const [person, setPerson] = useState<Person | null>(null);
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [history, setHistory] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSeeHistory = role === 'DIRECTOR' || role === 'ADMIN';

  useEffect(() => {
    api
      .person(id)
      .then((found) => {
        setPerson(found);
        // Los expedientes de la persona, para no tener que volver a buscarlos:
        // se piden por su DNI y se filtran por ficha, porque la búsqueda es
        // por texto y un DNI puede estar contenido en otro.
        return api
          .listCases({ q: found.dni })
          .then((list) => setCases(list.filter((c) => c.person.id === found.id)))
          .catch(() => setCases([]));
      })
      .catch((e: Error) => setError(e.message));
    if (canSeeHistory) {
      api.personHistory(id).then(setHistory).catch(() => setHistory([]));
    }
  }, [id, canSeeHistory]);

  if (error) return <p className="error">{error}</p>;
  if (!person) return <p className="muted">Abriendo la ficha…</p>;

  return (
    <div className="stack">
      <button type="button" className="link" onClick={onBack}>
        ← Volver a buscar
      </button>

      <article className="card">
        <h2>
          {person.lastName}, {person.firstName}
        </h2>
        <p className="muted">DNI {formatDni(person.dni)}</p>

        <dl className="facts">
          <Fact label="Fecha de nacimiento" value={formatDate(person.birthDate)} />
          <Fact
            label="Edad"
            value={
              person.birthDate
                ? `${yearsSince(person.birthDate)} años`
                : person.ageAtIntake != null
                  ? `${person.ageAtIntake} años, anotada en la atención`
                  : null
            }
          />
          <Fact label="Contacto" value={person.phone} />
          <Fact label="Barrio" value={person.neighborhood} />
          <Fact label="Domicilio" value={person.address} />
          <Fact label="Representante" value={person.representativeName} />
        </dl>
      </article>

      <article className="card">
        <h3>Anteojos y expedientes</h3>
        {cases === null && <p className="muted">Cargando…</p>}
        {cases?.length === 0 && (
          <p className="muted">Nunca pidió anteojos: esta ficha no tiene ningún expediente.</p>
        )}
        {cases && cases.length > 0 && (
          <ul className="cases-of-person">
            {cases.map((c) => (
              <li key={c.id}>
                <button type="button" className="link" onClick={() => onOpenCase(c.id)}>
                  <strong className="mono">{c.code}</strong>
                </button>
                <span>
                  {STAGE_LABELS[c.stage]}{' '}
                  <span className={c.overdue ? 'days late' : 'days'}>
                    hace {daysSince(c.stageSince)} d
                  </span>
                  {c.hold && <span className="chip hold">{HOLD_LABELS[c.hold]}</span>}
                </span>
                <span className="muted">
                  {c.glasses.length === 0
                    ? `${c.pairs} ${c.pairs === 1 ? 'par pedido' : 'pares pedidos'}, todavía sin código`
                    : c.glasses
                        .map(
                          (pair) =>
                            `${pair.code} (${pair.kind === 'CERCA' ? 'cerca' : 'lejos'}${pair.deliveredAt ? ', entregado' : ''})`,
                        )
                        .join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </article>

      {canSeeHistory && (
        <article className="card">
          <h3>Historial</h3>
          {history === null && <p className="muted">Cargando…</p>}
          {history?.length === 0 && <p className="muted">Todavía no hay movimientos.</p>}
          {history && history.length > 0 && (
            <ul className="history">
              {history.map((entry) => (
                <li key={entry.id}>
                  <span className="when">{formatDateTime(entry.occurredAt)}</span>
                  <span>
                    {ACTION_LABELS[entry.action]}
                    {entry.username ? ` · ${entry.username}` : ''}
                  </span>
                  {entry.changes && (
                    <span className="muted">{Object.keys(entry.changes).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value === null || value === '' ? <span className="muted">Sin dato</span> : value}</dd>
    </>
  );
}

function formatDate(value: string | null): string | null {
  return value ? new Date(value).toLocaleDateString('es-AR') : null;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

function yearsSince(birthDate: string): number {
  const birth = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthday) years -= 1;
  return years;
}
