import { useState } from 'react';
import { Login } from './Login';
import { Search } from './Search';
import { PersonDetail } from './PersonDetail';
import { ROLE_LABELS, writeToken, type SessionUser } from './lib/api';

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="centered">
        <Login onLogin={setUser} />
      </main>
    );
  }

  return (
    <>
      <header className="topbar">
        <strong>Ecolentes</strong>
        <span className="who">
          {user.fullName} · {ROLE_LABELS[user.role]}
        </span>
        <button
          type="button"
          className="link"
          onClick={() => {
            writeToken(null);
            setUser(null);
            setOpenPersonId(null);
          }}
        >
          Salir
        </button>
      </header>

      <main>
        {openPersonId ? (
          <PersonDetail
            id={openPersonId}
            role={user.role}
            onBack={() => setOpenPersonId(null)}
          />
        ) : (
          <Search onOpen={setOpenPersonId} />
        )}
      </main>
    </>
  );
}
