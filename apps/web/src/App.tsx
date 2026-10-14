import { useState } from 'react';
import { Login } from './Login';
import { Search } from './Search';
import { PersonDetail } from './PersonDetail';
import { CaseInbox } from './CaseInbox';
import { CaseDetail } from './CaseDetail';
import { NewCase } from './NewCase';
import { Redes } from './Redes';
import { Reports } from './Reports';
import { Users } from './Users';
import { PublicForm } from './PublicForm';
import { ROLE_LABELS, writeToken, type Role, type SessionUser } from './lib/api';

type Tab = 'bandeja' | 'personas' | 'nuevo' | 'redes' | 'indicadores' | 'usuarios';

const TABS: { key: Tab; label: string; roles: Role[] | null }[] = [
  { key: 'bandeja', label: 'Expedientes', roles: null },
  { key: 'personas', label: 'Personas', roles: ['OPERATOR', 'OPHTHALMOLOGIST', 'DIRECTOR', 'SOCIAL_DESK', 'ADMIN'] },
  { key: 'nuevo', label: 'Pedido nuevo', roles: ['OPERATOR', 'SOCIAL_DESK', 'ADMIN'] },
  { key: 'redes', label: 'Redes', roles: ['SOCIAL_DESK', 'OPERATOR', 'ADMIN'] },
  // La óptica no entra a los reportes: ve sus propios expedientes y nada más.
  { key: 'indicadores', label: 'Indicadores', roles: ['OPERATOR', 'OPHTHALMOLOGIST', 'DIRECTOR', 'SOCIAL_DESK', 'ADMIN'] },
  { key: 'usuarios', label: 'Usuarios', roles: ['ADMIN'] },
];

/**
 * El formulario del vecino no pasa por el login. Vive en /solicitud, y también
 * responde a #/solicitud para que ande donde la página se sirve desde una ruta
 * que no se puede reescribir, como la versión de demostración.
 *
 * Se mira el final de la ruta y no la ruta entera, porque la aplicación puede
 * estar montada adentro de otro sitio: ahí el formulario es
 * /ecolentes/solicitud y sigue siendo el mismo formulario.
 */
function isPublicForm(): boolean {
  return (
    /\/solicitud\/?$/.test(window.location.pathname) ||
    window.location.hash.startsWith('#/solicitud')
  );
}

export function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [tab, setTab] = useState<Tab>('bandeja');
  const [openCaseId, setOpenCaseId] = useState<string | null>(null);
  const [openPersonId, setOpenPersonId] = useState<string | null>(null);

  if (isPublicForm()) {
    return <PublicForm />;
  }

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
            onOpenCase={setOpenCaseId}
          />
        ) : tab === 'bandeja' ? (
          <CaseInbox onOpen={setOpenCaseId} />
        ) : tab === 'personas' ? (
          <Search onOpen={setOpenPersonId} onOpenCase={setOpenCaseId} />
        ) : tab === 'redes' ? (
          <Redes onOpen={setOpenCaseId} />
        ) : tab === 'indicadores' ? (
          <Reports role={user.role} onOpen={setOpenCaseId} />
        ) : tab === 'usuarios' ? (
          <Users me={user} />
        ) : (
          <NewCase onCreated={setOpenCaseId} />
        )}
      </main>
    </>
  );
}
