import { useState, type FormEvent } from 'react';
import { api, ApiError, type Person } from './lib/api';

type Props = { dni: string; onCreated: (person: Person) => void; onCancel: () => void };

export function PersonForm({ dni, onCreated, onCancel }: Props) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    birthDate: '',
    ageAtIntake: '',
    phone: '',
    neighborhood: '',
    address: '',
    representativeName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    setDuplicateId(null);
    try {
      const person = await api.createPerson({
        dni,
        firstName: form.firstName,
        lastName: form.lastName,
        ...(form.birthDate ? { birthDate: form.birthDate } : {}),
        ...(form.ageAtIntake ? { ageAtIntake: Number(form.ageAtIntake) } : {}),
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.neighborhood ? { neighborhood: form.neighborhood } : {}),
        ...(form.address ? { address: form.address } : {}),
        ...(form.representativeName ? { representativeName: form.representativeName } : {}),
      });
      onCreated(person);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const body = e.body as { personId?: string } | null;
        setDuplicateId(body?.personId ?? null);
        setError('Ya hay una ficha con ese DNI.');
      } else {
        setError(e instanceof Error ? e.message : 'No se pudo guardar');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h2>Ficha nueva</h2>
      <p className="muted">DNI {dni}</p>

      <div className="grid">
        <div>
          <label htmlFor="lastName">Apellido</label>
          <input
            id="lastName"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="firstName">Nombre</label>
          <input
            id="firstName"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="birthDate">Fecha de nacimiento</label>
          <input
            id="birthDate"
            type="date"
            value={form.birthDate}
            onChange={(e) => set('birthDate', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="ageAtIntake">Edad, si no tenés la fecha</label>
          <input
            id="ageAtIntake"
            type="number"
            min="0"
            max="120"
            value={form.ageAtIntake}
            onChange={(e) => set('ageAtIntake', e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="phone">Contacto</label>
          <input id="phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
        </div>
        <div>
          <label htmlFor="neighborhood">Barrio</label>
          <input
            id="neighborhood"
            value={form.neighborhood}
            onChange={(e) => set('neighborhood', e.target.value)}
          />
        </div>
        <div className="full">
          <label htmlFor="address">Domicilio</label>
          <input
            id="address"
            value={form.address}
            onChange={(e) => set('address', e.target.value)}
          />
        </div>
        <div className="full">
          <label htmlFor="representativeName">Representante, si es menor</label>
          <input
            id="representativeName"
            value={form.representativeName}
            onChange={(e) => set('representativeName', e.target.value)}
          />
        </div>
      </div>

      {error && (
        <p className="error">
          {error}{' '}
          {duplicateId && (
            <button type="button" className="link" onClick={() => onCreated({ id: duplicateId } as Person)}>
              Abrir la ficha que ya existe
            </button>
          )}
        </p>
      )}

      <div className="actions">
        <button type="submit" disabled={sending}>
          {sending ? 'Guardando…' : 'Guardar ficha'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
