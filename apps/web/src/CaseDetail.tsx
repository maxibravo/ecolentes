import { useCallback, useEffect, useState } from 'react';
import {
  api,
  CHANNEL_LABELS,
  daysSince,
  formatDate,
  formatDni,
  HOLD_LABELS,
  STAGE_LABELS,
  type CaseDetail as Detail,
  type Role,
} from './lib/api';
import { CaseActions } from './CaseActions';
import { CasePhotos } from './CasePhotos';

export function CaseDetail({
  id,
  role,
  onBack,
}: {
  id: string;
  role: Role;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .case(id)
      .then(setDetail)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!detail) return <p className="muted">Abriendo el expediente…</p>;

  const p = detail.person;
  // La óptica no tiene por qué ver quién es la persona.
  const hidePerson = role === 'OPTICIAN';

  return (
    <div className="stack">
      <button type="button" className="link" onClick={onBack}>
        ← Volver a la bandeja
      </button>

      <article className="card">
        <div className="case-head">
          <h2>{detail.code}</h2>
          <span className="chip">{STAGE_LABELS[detail.stage]}</span>
          <span className={detail.overdue ? 'days late' : 'days'}>
            {daysSince(detail.stageSince)} días en esta etapa
          </span>
        </div>

        {detail.hold && (
          <p className="hold-note">
            <strong>{HOLD_LABELS[detail.hold]}.</strong> {detail.holdNote}
          </p>
        )}

        <dl className="facts">
          <dt>Persona</dt>
          <dd>
            {hidePerson ? (
              <span className="masked">
                {p.firstName[0]}
                {p.lastName[0]} · sólo iniciales
              </span>
            ) : (
              <>
                {p.lastName}, {p.firstName} · DNI {formatDni(p.dni)}
              </>
            )}
          </dd>
          {!hidePerson && (
            <>
              <dt>Contacto</dt>
              <dd>{p.phone ?? <span className="muted">Sin teléfono</span>}</dd>
              <dt>Barrio</dt>
              <dd>{p.neighborhood ?? <span className="muted">Sin dato</span>}</dd>
            </>
          )}
          <dt>Llegó por</dt>
          <dd>{CHANNEL_LABELS[detail.channel]}</dd>
          {!hidePerson && (
            <>
              <dt>Óptica</dt>
              <dd>{detail.optician?.name ?? <span className="muted">Sin asignar</span>}</dd>
            </>
          )}
          <dt>Pares</dt>
          <dd>{detail.pairs}</dd>
        </dl>
      </article>

      {detail.glasses.length > 0 && (
        <article className="card">
          <h3>Anteojos</h3>
          <p className="muted">
            Cada par tiene su propio código. Es el que se le dicta a la persona, y con el que se
            puede buscar en la bandeja.
          </p>
          <ul className="glasses">
            {detail.glasses.map((pair) => (
              <li key={pair.code}>
                <strong className="mono">{pair.code}</strong>
                <span>{pair.kind === 'CERCA' ? 'Cerca' : 'Lejos'}</span>
                <span className={pair.deliveredAt ? 'chip' : 'muted'}>
                  {pair.deliveredAt
                    ? `Entregado el ${formatDate(pair.deliveredAt)}`
                    : 'En el municipio'}
                </span>
              </li>
            ))}
          </ul>
        </article>
      )}

      {detail.prescription && (
        <article className="card">
          <h3>Receta</h3>
          <p className="mono">{detail.prescription.rawText}</p>
          <dl className="facts">
            <dt>Ojo derecho</dt>
            <dd>{eye(detail.prescription.farRightSphere, detail.prescription.farRightCylinder, detail.prescription.farRightAxis)}</dd>
            <dt>Ojo izquierdo</dt>
            <dd>{eye(detail.prescription.farLeftSphere, detail.prescription.farLeftCylinder, detail.prescription.farLeftAxis)}</dd>
            <dt>Cerca</dt>
            <dd>
              {detail.prescription.nearAddition != null ? (
                `ADD ${detail.prescription.nearAddition}`
              ) : (
                <span className="muted">Sin adición</span>
              )}
            </dd>
          </dl>
          <p className={detail.prescription.validatedAt ? 'muted' : 'error'}>
            {detail.prescription.validatedAt
              ? 'Validada por el profesional.'
              : 'Falta que la valide el profesional.'}
          </p>
        </article>
      )}

      <CasePhotos detail={detail} role={role} onChange={load} />

      {detail.quotes.length > 0 && (
        <article className="card">
          <h3>Propuestas de la óptica</h3>
          <ul className="quotes">
            {detail.quotes.map((q) => (
              <li key={q.id} className={q.status === 'OBSERVED' ? 'observed' : ''}>
                <div className="quote-head">
                  <strong>Versión {q.version}</strong>
                  <span className="chip">{QUOTE_LABELS[q.status]}</span>
                </div>
                <span>
                  {q.lenses} · {q.frame}
                  {q.leadDays != null ? ` · ${q.leadDays} días` : ''}
                  {q.amount != null ? ` · $${q.amount}` : ''}
                </span>
                {q.decisionNote && <span className="muted">{q.decisionNote}</span>}
              </li>
            ))}
          </ul>
        </article>
      )}

      {detail.delivery && (
        <article className="card">
          <h3>Entrega</h3>
          <p>
            {new Date(detail.delivery.deliveredAt).toLocaleDateString('es-AR')} · retiró{' '}
            {detail.delivery.receivedBy}
            {detail.delivery.isRepresentative
              ? ` (${detail.delivery.receivedByDni ? `DNI ${formatDni(detail.delivery.receivedByDni)}` : 'representante'})`
              : ''}
          </p>
          {detail.delivery.note && <p className="muted">{detail.delivery.note}</p>}
        </article>
      )}

      <CaseActions detail={detail} role={role} onDone={load} />

      <article className="card">
        <h3>Historial</h3>
        <ul className="history">
          {detail.events.map((e) => (
            <li key={e.id}>
              <span className="when">
                {new Date(e.occurredAt).toLocaleString('es-AR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </span>
              <span>
                {e.fromStage && e.toStage
                  ? `${STAGE_LABELS[e.fromStage]} → ${STAGE_LABELS[e.toStage]}`
                  : e.hold
                    ? HOLD_LABELS[e.hold]
                    : (e.note ?? '—')}
              </span>
              <span className="muted">
                {e.username ?? 'sistema'}
                {e.fromStage && e.note ? ` · ${e.note}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </article>
    </div>
  );
}

const QUOTE_LABELS = {
  SUBMITTED: 'Esperando aprobación',
  APPROVED: 'Aprobada',
  OBSERVED: 'Observada',
} as const;

function eye(sphere: string | null, cylinder: string | null, axis: number | null) {
  if (sphere === null && cylinder === null && axis === null) {
    return <span className="muted">No se pudo interpretar, mirá el texto de arriba</span>;
  }
  const parts = [
    axis !== null ? `eje ${axis}°` : null,
    sphere !== null ? `esf ${sphere}` : null,
    cylinder !== null ? `cil ${cylinder}` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}
