import { useState } from 'react';
import { Login } from './Login';
import { Search } from './Search';
import { PersonDetail } from './PersonDetail';
import { CaseInbox } from './CaseInbox';
import { CaseDetail } from './CaseDetail';
import { NewCase } from './NewCase';
import { ROLE_LABELS, writeToken, type Role, type SessionUser } from './lib/api';

type Tab = 'bandeja' | 'personas' | 'nuevo';

const TABS: { key: Tab; label: string; roles: Role[] | null }[] = [
  { key: 'bandeja', label: 'Expedientes', roles: null },
  { key: 'personas', label: 'Personas', roles: ['OPERATOR', 'OPHTHALMOLOGIST', 'DIRECTOR', 'SOCIAL_DESK', 'ADMIN'] },
  { key: 'nuevo', label: 'Pedido nuevo', roles: ['OPERATOR', 'SOCIAL_DESK', 'ADMIN'] },
];

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>('bandeja');
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);

  if (!user) {
    return (
      <main className="centered">
        <Login onLogin={setUser} />
      </main>
    );
  }

  const tabs = TABS.filter((t) => t.roles === null || t.roles.includes(user.role));

  function go(next: Tab) {
    setTab(next);
    setOpenCaseId(null);
    setOpenPersonId(null);
  }

  return (
    <>
      <header className="topbar">
        <strong>Ecolentes</strong>
        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={t.key === tab ? 'tab active' : 'tab'}
              onClick={() => go(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="who">
          {user.fullName} · {ROLE_LABELS[user.role]}
        </span>
        <button
          type="button"
          className="link"
          onClick={() => {
            writeToken(null);
            setUser(null);
          }}
        >
          Salir
        </button>
      </header>

      <main>
        {openCaseId ? (
          <CaseDetail id={openCaseId} role={user.role} onBack={() => setOpenCaseId(null)} />
        ) : openPersonId ? (
          <PersonDetail
            id={openPersonId}
            role={user.role}
            onBack={() => setOpenPersonId(null)}
          />
        ) : tab === 'bandeja' ? (
          <CaseInbox onOpen={setOpenCaseId} />
        ) : tab === 'personas' ? (
          <Search onOpen={setOpenPersonId} />
        ) : (
          <NewCase onCreated={setOpenCaseId} />
        )}
      </main>
    </>
  );
}
