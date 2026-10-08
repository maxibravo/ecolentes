import { useState, type FormEvent } from 'react';
import { api, type CaseDetail, type Role } from './lib/api';

type Props = { detail: CaseDetail; role: Role; onDone: () => void };

/**
 * Lo que este rol puede hacer con el expediente ahora mismo. Se muestra sólo
 * la acción que corresponde a la etapa, para que nadie tenga que acordarse
 * del circuito.
 */
export function CaseActions({ detail, role, onDone }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo hacer');
    } finally {
      setBusy(false);
    }
  }

  const isAdmin = role === 'ADMIN';
  const can = (r: Role) => role === r || isAdmin;

  return (
    <div className="card">
      <h3>Próximo paso</h3>
      {error && <p className="error">{error}</p>}

      {detail.stage === 'REQUEST' && can('OPERATOR') && (
        <ActionButton
          busy={busy}
          label="Mandar a evaluación"
          onClick={() => run(() => api.moveStage(detail.id, 'ASSESSMENT'))}
        />
      )}

      {detail.stage === 'ASSESSMENT' && (can('OPHTHALMOLOGIST') || can('OPERATOR')) && (
        <PrescriptionForm detail={detail} role={role} busy={busy} run={run} />
      )}

      {detail.stage === 'OPTICIAN_QUOTE' && can('OPTICIAN') && (
        <QuoteForm caseId={detail.id} busy={busy} run={run} />
      )}

      {detail.stage === 'APPROVAL' && can('DIRECTOR') && (
        <ApprovalForm caseId={detail.id} busy={busy} run={run} />
      )}

      {detail.stage === 'PRODUCTION' && can('OPTICIAN') && (
        <ActionButton
          busy={busy}
          label="Entregado a la municipalidad"
          onClick={() => run(() => api.moveStage(detail.id, 'RECEIVED'))}
        />
      )}

      {detail.stage === 'RECEIVED' && can('OPERATOR') && (
        <ActionButton
          busy={busy}
          label="Controlado, listo para entregar"
          onClick={() => run(() => api.moveStage(detail.id, 'READY_FOR_PICKUP'))}
        />
      )}

      {detail.stage === 'READY_FOR_PICKUP' && can('OPERATOR') && (
        <DeliveryForm caseId={detail.id} person={detail.person} busy={busy} run={run} />
      )}

      {detail.stage === 'DELIVERED' && can('OPERATOR') && (
        <ActionButton
          busy={busy}
          label="Cerrar el expediente"
          onClick={() => run(() => api.moveStage(detail.id, 'CLOSED'))}
        />
      )}

      {detail.stage === 'CLOSED' && <p className="muted">El expediente está cerrado.</p>}
    </div>
  );
}

function ActionButton({
  label,
  busy,
  onClick,
}: {
  label: string;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={busy} onClick={onClick}>
      {busy ? 'Guardando…' : label}
    </button>
  );
}

function PrescriptionForm({
  detail,
  role,
  busy,
  run,
}: {
  detail: CaseDetail;
  role: Role;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [text, setText] = useState(detail.prescription?.rawText ?? '');
  const validated = detail.prescription?.validatedAt != null;

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() => api.setPrescription(detail.id, text));
  }

  return (
    <form onSubmit={submit} className="stack-tight">
      <label htmlFor="receta">Graduación, como figura en la receta</label>
      <input
        id="receta"
        value={text}
        placeholder="LEJOS OD 180°-3,50 // OI 180°-2,75 - CERCA ADD+1,50 AO"
        onChange={(e) => setText(e.target.value)}
        required
      />
      <p className="muted">
        Se guarda tal cual y además se separa por ojo, para que la óptica no vuelva a tipearla.
      </p>
      <div className="actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar receta'}
        </button>
        {validated && (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void run(() => api.moveStage(detail.id, 'OPTICIAN_QUOTE'))}
          >
            Mandar a la óptica
          </button>
        )}
      </div>
      {!validated && detail.prescription && (
        <p className="muted">
          La receta todavía no fue validada por el profesional, así que no puede ir a la óptica.
        </p>
      )}
      {role !== 'OPHTHALMOLOGIST' && (
        <p className="muted">Si la cargás vos, el profesional después tiene que validarla.</p>
      )}
    </form>
  );
}

function QuoteForm({
  caseId,
  busy,
  run,
}: {
  caseId: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [lenses, setLenses] = useState('');
  const [frame, setFrame] = useState('');
  const [leadDays, setLeadDays] = useState('');
  const [amount, setAmount] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      api.submitQuote(caseId, {
        lenses,
        frame,
        ...(leadDays ? { leadDays: Number(leadDays) } : {}),
        ...(amount ? { amount: Number(amount) } : {}),
      }),
    );
  }

  return (
    <form onSubmit={submit} className="stack-tight">
      <div className="grid">
        <div>
          <label htmlFor="cristales">Cristales</label>
          <input
            id="cristales"
            value={lenses}
            onChange={(e) => setLenses(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="armazon">Armazón</label>
          <input id="armazon" value={frame} onChange={(e) => setFrame(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="plazo">Días de fabricación</label>
          <input
            id="plazo"
            type="number"
            min="0"
            value={leadDays}
            onChange={(e) => setLeadDays(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="monto">Monto</label>
          <input
            id="monto"
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </div>
      <button type="submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar propuesta'}
      </button>
    </form>
  );
}

function ApprovalForm({
  caseId,
  busy,
  run,
}: {
  caseId: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="stack-tight">
      <label htmlFor="observacion">Qué corregir, si la observás</label>
      <input
        id="observacion"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="El armazón no corresponde a la edad"
      />
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.decideQuote(caseId, true, note || undefined))}
        >
          Aprobar
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy || !note.trim()}
          onClick={() => void run(() => api.decideQuote(caseId, false, note))}
        >
          Observar y devolver
        </button>
      </div>
      {!note.trim() && (
        <p className="muted">Para observarla hay que decir qué corregir.</p>
      )}
    </div>
  );
}

function DeliveryForm({
  caseId,
  person,
  busy,
  run,
}: {
  caseId: string;
  person: CaseDetail['person'];
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) {
  const fullName = `${person.firstName} ${person.lastName}`;
  const [receivedBy, setReceivedBy] = useState(fullName);
  const [isRepresentative, setIsRepresentative] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    void run(() =>
      api.registerDelivery(caseId, {
        deliveredAt: new Date().toISOString(),
        receivedBy,
        isRepresentative,
      }),
    );
  }

  return (
    <form onSubmit={submit} className="stack-tight">
      <label htmlFor="recibio">Quién retiró</label>
      <input
        id="recibio"
        value={receivedBy}
        onChange={(e) => setReceivedBy(e.target.value)}
        required
      />
      <label className="check">
        <input
          type="checkbox"
          checked={isRepresentative}
          onChange={(e) => {
            setIsRepresentative(e.target.checked);
            if (e.target.checked && receivedBy === fullName && person.representativeName) {
              setReceivedBy(person.representativeName);
            }
          }}
        />
        No es la persona, retira un representante
      </label>
      <button type="submit" disabled={busy}>
        {busy ? 'Guardando…' : 'Registrar la entrega'}
      </button>
    </form>
  );
}
