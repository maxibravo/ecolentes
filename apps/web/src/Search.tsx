import { useEffect, useState } from 'react';
import {
  api,
  daysSince,
  formatDate,
  formatDni,
  HOLD_LABELS,
  STAGE_LABELS,
  type PersonWithSummary,
} from './lib/api';
import { PersonForm } from './PersonForm';

type Props = { onOpen: (id: string) => void; onOpenCase: (id: string) => void };

export function Search({ onOpen, onOpenCase }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PersonWithSummary[] | null>(null);
  const [creatingDni, setCreatingDni] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const texto = query.trim();

  /**
   * Busca mientras se escribe. Espera un momento entre tecla y tecla para no
   * mandar una consulta por carácter, y cancela la anterior: si no, con un DNI
   * de ocho dígitos la respuesta de "3162" puede llegar después de la de
   * "31620034" y pisarla.
   */
  useEffect(() => {
    if (texto.length < 2) {
      setResults(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      api
        .searchPeople(texto, controller.signal)
        .then((found) => setResults(found))
        .catch((e: Error) => {
          if (controller.signal.aborted) return;
          setError(e.message);
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [texto]);

  const digitsOnly = texto.replace(/\D/g, '');
  const looksLikeDni = digitsOnly.length >= 7 && digitsOnly.length <= 8;

  if (creatingDni) {
    return (
      <PersonForm
        dni={creatingDni}
        onCreated={(person) => onOpen(person.id)}
        onCancel={() => setCreatingDni(null)}
      />
    );
  }

  return (
    <div className="stack">
      <div className="card search">
        <label htmlFor="q">Buscar por DNI, apellido o nombre</label>
        <input
          id="q"
          value={query}
          placeholder="31.620.034"
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="muted">
          Filtra mientras escribís. Buscá siempre antes de cargar: si la persona ya fue atendida, su
          ficha existe.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      {texto.length >= 2 && results === null && searching && <p className="muted">Buscando…</p>}

      {results && results.length === 0 && (
        <div className="card">
          <p>No hay ninguna ficha que coincida con “{texto}”.</p>
          {looksLikeDni ? (
            <button type="button" onClick={() => setCreatingDni(digitsOnly)}>
              Cargar ficha nueva con DNI {formatDni(digitsOnly)}
            </button>
          ) : (
            <p className="muted">Para cargar una ficha nueva, buscá primero por el DNI.</p>
          )}
        </div>
      )}

      {results && results.length > 0 && (
        <div className="card stack-tight">
          <table className="report people">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Expediente en curso</th>
                <th>Anteojos</th>
                <th className="num">Edad</th>
                <th>Barrio</th>
              </tr>
            </thead>
            <tbody>
              {results.map((person) => (
                <Row
                  key={person.id}
                  person={person}
                  onOpen={() => onOpen(person.id)}
                  onOpenCase={onOpenCase}
                />
              ))}
            </tbody>
          </table>
          <p className="muted">
            {results.length} {results.length === 1 ? 'ficha' : 'fichas'}. Tocá una fila para abrir
            la ficha completa.
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  person,
  onOpen,
  onOpenCase,
}: {
  person: PersonWithSummary;
  onOpen: () => void;
  onOpenCase: (id: string) => void;
}) {
  const { summary } = person;
  const open = summary.openCase;

  return (
    <tr className="clickable" onClick={onOpen}>
      <td>
        <strong>
          {person.lastName}, {person.firstName}
        </strong>
        <br />
        <span className="muted">DNI {formatDni(person.dni)}</span>
      </td>
      <td>
        {open ? (
          <button
            type="button"
            className="link"
            onClick={(event) => {
              event.stopPropagation();
              onOpenCase(open.id);
            }}
          >
            <strong>{open.code}</strong>
            <br />
            {STAGE_LABELS[open.stage]}{' '}
            <span className={open.overdue ? 'days late' : 'days'}>
              hace {daysSince(open.stageSince)} d
            </span>
            {open.hold && <span className="chip hold">{HOLD_LABELS[open.hold]}</span>}
            {open.glasses.length > 0 && (
              <>
                <br />
                <span className="muted">{open.glasses.map((pair) => pair.code).join(' · ')}</span>
              </>
            )}
          </button>
        ) : (
          <span className="muted">—</span>
        )}
      </td>
      <td>
        {summary.cases === 0 ? (
          <span className="muted">Nunca pidió</span>
        ) : (
          <>
            {summary.pairsDelivered} de {summary.pairsRequested}{' '}
            {summary.pairsRequested === 1 ? 'par entregado' : 'pares entregados'}
            {summary.lastDeliveryAt && (
              <>
                <br />
                <span className="muted">último el {formatDate(summary.lastDeliveryAt)}</span>
              </>
            )}
          </>
        )}
      </td>
      <td className="num">
        {summary.age ?? <span className="muted">—</span>}
        {summary.isMinor === true && <span className="chip">menor</span>}
      </td>
      <td>{person.neighborhood ?? <span className="muted">—</span>}</td>
    </tr>
  );
}
