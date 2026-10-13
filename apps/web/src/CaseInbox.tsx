import { useEffect, useState } from 'react';
import {
  api,
  daysSince,
  formatDni,
  HOLD_LABELS,
  STAGE_LABELS,
  type CaseStage,
  type CaseSummary,
} from './lib/api';

const STAGE_ORDER: CaseStage[] = [
  'REQUEST',
  'ASSESSMENT',
  'OPTICIAN_QUOTE',
  'APPROVAL',
  'PRODUCTION',
  'RECEIVED',
  'READY_FOR_PICKUP',
  'DELIVERED',
  'CLOSED',
];

export function CaseInbox({ onOpen }: { onOpen: (id: string) => void }) {
  const [cases, setCases] = useState<CaseSummary[] | null>(null);
  const [stage, setStage] = useState<CaseStage | ''>('');
  const [q, setQ] = useState('');
  const [overdue, setOverdue] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .listCases({ stage, q, overdue })
      .then((found) => {
        if (!cancelled) setCases(found);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [stage, q, overdue]);

  const delayed = cases?.filter((c) => c.overdue).length ?? 0;

  return (
    <div className="stack">
      <div className="card filters">
        <div className="row">
          <input
            id="buscar"
            value={q}
            placeholder="Buscar por expediente, anteojo, apellido o DNI"
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            id="etapa"
            value={stage}
            onChange={(e) => setStage(e.target.value as CaseStage | '')}
          >
            <option value="">Todas las etapas</option>
            {STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => setOverdue(e.target.checked)}
          />
          Sólo los que pasaron el plazo
          {delayed > 0 && !overdue && <span className="badge late">{delayed}</span>}
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {cases === null && !error && <p className="muted">Cargando expedientes…</p>}
      {cases?.length === 0 && (
        <p className="muted">No hay expedientes que coincidan con lo que buscaste.</p>
      )}

      {cases && cases.length > 0 && (
        <ul className="cases">
          {cases.map((c) => (
            <li key={c.id}>
              <button type="button" className="case-row" onClick={() => onOpen(c.id)}>
                <span className="code">{c.code}</span>
                <span className="who">
                  <strong>
                    {c.person.lastName}, {c.person.firstName}
                  </strong>
                  <span className="muted">
                    DNI {formatDni(c.person.dni)}
                    {c.person.neighborhood ? ` · ${c.person.neighborhood}` : ''}
                  </span>
                </span>
                <span className="stage-cell">
                  <span className="chip">{STAGE_LABELS[c.stage]}</span>
                  <span className={c.overdue ? 'days late' : 'days'}>
                    {daysSince(c.stageSince)} días
                  </span>
                  {c.hold && <span className="chip hold">{HOLD_LABELS[c.hold]}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
