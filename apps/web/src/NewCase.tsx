import { useState, type FormEvent } from 'react';
import {
  api,
  ApiError,
  CHANNEL_LABELS,
  formatDni,
  type IntakeChannel,
  type Person,
} from './lib/api';
import { BirthDate, birthDateFields, EMPTY_BIRTH_DATE } from './BirthDate';

/**
 * Carga de un pedido nuevo. Pensada para usarse en el barrio desde el teléfono,
 * pero es la misma pantalla web de siempre. Primero el DNI, porque si la
 * persona ya fue atendida su ficha existe y no hay que volver a cargarla.
 */
export function NewCase({ onCreated }: { onCreated: (caseId: string) => void }) {
  const [dni, setDni] = useState('');
  const [person, setPerson] = useState<Person | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    neighborhood: '',
    representativeName: '',
    ...EMPTY_BIRTH_DATE,
  });
  const [channel, setChannel] = useState<IntakeChannel>('NEIGHBORHOOD_SURVEY');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sin fecha ni edad no se puede saber si es menor, y de eso depende a quién se
  // le entregan los anteojos. Se pide una de las dos antes de guardar la ficha.
  const sinEdad = form.birthDate === '' && form.ageAtIntake === '';

  async function lookUp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPerson(null);
    setNotFound(false);
    setBusy(true);
    try {
      setPerson(await api.personByDni(dni));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNotFound(true);
      else setError(e instanceof Error ? e.message : 'No se pudo buscar');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const target =
        person ??
        (await api.createPerson({
          dni,
          firstName: form.firstName,
          lastName: form.lastName,
          ...birthDateFields(form),
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.neighborhood ? { neighborhood: form.neighborhood } : {}),
          ...(form.representativeName ? { representativeName: form.representativeName } : {}),
        }));
      const created = await api.createCase({
        personId: target.id,
        channel,
        ...(reason ? { reason } : {}),
      });
      onCreated(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el pedido');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack phone">
      <form className="card" onSubmit={lookUp}>
        <h2>Pedido nuevo</h2>
        <label htmlFor="dni">DNI de la persona</label>
        <div className="row">
          <input
            id="dni"
            inputMode="numeric"
            value={dni}
            placeholder="31620034"
            onChange={(e) => setDni(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Buscar
          </button>
        </div>
        <p className="muted">Alcanza con el número, no hace falta el documento.</p>
      </form>

      {error && <p className="error">{error}</p>}

      {person && (
        <form className="card" onSubmit={submit}>
          <h3>
            {person.lastName}, {person.firstName}
          </h3>
          <p className="muted">
            DNI {formatDni(person.dni)}
            {person.neighborhood ? ` · ${person.neighborhood}` : ''} · ya tiene ficha
          </p>
          <Channel value={channel} onChange={setChannel} />
          <Reason value={reason} onChange={setReason} />
          <button type="submit" disabled={busy}>
            {busy ? 'Cargando…' : 'Cargar el pedido'}
          </button>
        </form>
      )}

      {notFound && (
        <form className="card" onSubmit={submit}>
          <h3>Ficha nueva</h3>
          <p className="muted">DNI {formatDni(dni.replace(/\D/g, ''))}</p>
          <div className="grid">
            <div>
              <label htmlFor="apellido">Apellido</label>
              <input
                id="apellido"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="nombre">Nombre</label>
              <input
                id="nombre"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label htmlFor="tel">Contacto</label>
              <input
                id="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="barrio">Barrio</label>
              <input
                id="barrio"
                value={form.neighborhood}
                onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
              />
            </div>
            <BirthDate
              value={form}
              onChange={(value) => setForm((f) => ({ ...f, ...value }))}
              hasRepresentative={form.representativeName !== ''}
            />
            <div className="full">
              <label htmlFor="representante">Padre, madre o tutor, si es menor</label>
              <input
                id="representante"
                value={form.representativeName}
                onChange={(e) => setForm({ ...form, representativeName: e.target.value })}
              />
            </div>
          </div>
          {!form.phone && (
            <p className="muted">
              Sin teléfono no vamos a poder avisarle cuando lleguen los anteojos.
            </p>
          )}
          <Channel value={channel} onChange={setChannel} />
          <Reason value={reason} onChange={setReason} />
          <button type="submit" disabled={busy || sinEdad}>
            {busy ? 'Cargando…' : 'Cargar ficha y pedido'}
          </button>
        </form>
      )}
    </div>
  );
}

function Channel({
  value,
  onChange,
}: {
  value: IntakeChannel;
  onChange: (v: IntakeChannel) => void;
}) {
  return (
    <>
      <label htmlFor="canal">Por dónde llegó</label>
      <select
        id="canal"
        value={value}
        onChange={(e) => onChange(e.target.value as IntakeChannel)}
      >
        {(Object.keys(CHANNEL_LABELS) as IntakeChannel[]).map((c) => (
          <option key={c} value={c}>
            {CHANNEL_LABELS[c]}
          </option>
        ))}
      </select>
    </>
  );
}

function Reason({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <label htmlFor="motivo">Motivo</label>
      <input
        id="motivo"
        value={value}
        placeholder="ve borroso de lejos"
        onChange={(e) => onChange(e.target.value)}
      />
    </>
  );
}
