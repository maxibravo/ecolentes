import { useState, type FormEvent } from 'react';
import { api, formatDni, type Person } from './lib/api';
import { PersonForm } from './PersonForm';

type Props = { onOpen: (id: string) => void };

export function Search({ onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[] | null>(null);
  const [searchedFor, setSearchedFor] = useState('');
  const [creatingDni, setCreatingDni] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setCreatingDni(null);
    try {
      const found = await api.searchPeople(query.trim());
      setResults(found);
      setSearchedFor(query.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar');
    }
  }

  const digitsOnly = searchedFor.replace(/\D/g, '');
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
      <form className="card search" onSubmit={submit}>
        <label htmlFor="q">Buscar por DNI, apellido o nombre</label>
        <div className="row">
          <input
            id="q"
            value={query}
            placeholder="31.620.034"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">Buscar</button>
        </div>
        <p className="muted">
          Buscá siempre antes de cargar. Si la persona ya fue atendida, su ficha existe.
        </p>
      </form>

      {error && <p className="error">{error}</p>}

      {results && (
        <div className="card">
          {results.length === 0 ? (
            <>
              <p>No hay ninguna ficha que coincida con “{searchedFor}”.</p>
              {looksLikeDni ? (
                <button type="button" onClick={() => setCreatingDni(digitsOnly)}>
                  Cargar ficha nueva con DNI {formatDni(digitsOnly)}
                </button>
              ) : (
                <p className="muted">Para cargar una ficha nueva, buscá primero por el DNI.</p>
              )}
            </>
          ) : (
            <>
              <h3>
                {results.length} {results.length === 1 ? 'ficha' : 'fichas'}
              </h3>
              <ul className="results">
                {results.map((person) => (
                  <li key={person.id}>
                    <button type="button" className="result" onClick={() => onOpen(person.id)}>
                      <strong>
                        {person.lastName}, {person.firstName}
                      </strong>
                      <span className="muted">
                        DNI {formatDni(person.dni)}
                        {person.neighborhood ? ` · ${person.neighborhood}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
