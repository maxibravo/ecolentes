import { useEffect, useState } from 'react';
import {
  api,
  CHANNEL_LABELS,
  formatDate,
  formatDni,
  HOLD_LABELS,
  seesIdentityInReports,
  STAGE_LABELS,
  type DeliveriesReport,
  type PendingReport,
  type PersonReport,
  type Role,
  type Summary,
} from './lib/api';

type Tab = 'resumen' | 'entregas' | 'pendientes' | 'persona';

const TABS: { key: Tab; label: string; nominal: boolean }[] = [
  { key: 'resumen', label: 'Resumen', nominal: false },
  { key: 'entregas', label: 'Padrón de entregas', nominal: false },
  { key: 'pendientes', label: 'Pendientes de entrega', nominal: false },
  { key: 'persona', label: 'Por persona', nominal: true },
];

export function Reports({ role, onOpen }: { role: Role; onOpen: (caseId: string) => void }) {
  const nominal = seesIdentityInReports(role);
  const [tab, setTab] = useState<Tab>('resumen');
  const tabs = TABS.filter((t) => !t.nominal || nominal);

  return (
    <div className="stack">
      <div className="card stack-tight">
        <h2>Indicadores y reportes</h2>
        <p className="muted">
          Cada número sale de los expedientes, así que se puede abrir y ver de dónde salió.
          {!nominal && ' Tu rol ve los totales y el seguimiento, sin la identidad de las personas.'}
        </p>
        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={t.key === tab ? 'tab active' : 'tab'}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'resumen' && <SummaryView />}
      {tab === 'entregas' && <DeliveriesView onOpen={onOpen} />}
      {tab === 'pendientes' && <PendingView onOpen={onOpen} />}
      {tab === 'persona' && nominal && <PersonView onOpen={onOpen} />}
    </div>
  );
}

/** Carga un reporte y deja el componente libre de try/catch repetidos. */
function useReport<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setData(null);
    load()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}

function Kpi({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-value">{value}</span>
      <span className="kpi-label">{label}</span>
      {hint && <span className="muted">{hint}</span>}
    </div>
  );
}

/** Barra proporcional al valor más alto de la lista. */
function Bars({ rows }: { rows: { label: string; total: number; overdue?: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar" key={r.label}>
          <span className="bar-label">{r.label}</span>
          <span className="track">
            <span
              className="fill"
              style={{ width: `${((r.total - (r.overdue ?? 0)) / max) * 100}%` }}
            />
            <span className="fill late" style={{ width: `${((r.overdue ?? 0) / max) * 100}%` }} />
          </span>
          <b>{r.total}</b>
        </div>
      ))}
    </div>
  );
}

function SummaryView() {
  const [shareable, setShareable] = useState(false);
  const { data, error } = useReport<Summary>(() => api.summary(shareable), [shareable]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Calculando…</p>;

  const k = data.kpis;
  return (
    <div className="stack">
      <div className="kpis">
        <Kpi value={k.requests} label="Solicitudes" hint={`${k.people} personas distintas`} />
        <Kpi value={k.pairs} label="Pares pedidos" hint="Lejos y cerca cuentan como dos" />
        <Kpi
          value={k.deliveredPairs}
          label="Pares entregados"
          hint={`En ${k.deliveredCases} expedientes`}
        />
        <Kpi
          value={k.approvedNotDelivered}
          label="Aprobados sin entregar"
          hint="No cuentan como entrega"
        />
        <Kpi value={k.overdue} label="Fuera de plazo" hint={`De ${k.open} abiertos`} />
        <Kpi value={k.onHold} label="Frenados" hint="Siguen abiertos, con motivo" />
      </div>

      {k.unverifiedIdentity > 0 && (
        <p className="warn-box">
          {k.unverifiedIdentity} {k.unverifiedIdentity === 1 ? 'pedido entró' : 'pedidos entraron'}{' '}
          por el formulario público y nadie confirmó todavía la identidad.
        </p>
      )}

      <div className="card stack-tight">
        <h3>Dónde están hoy los pedidos</h3>
        <Bars
          rows={data.byStage.map((s) => ({
            label: STAGE_LABELS[s.stage],
            total: s.total,
            overdue: s.overdue,
          }))}
        />
        <p className="muted">La parte roja de cada barra es lo que pasó el plazo de su etapa.</p>
      </div>

      <div className="card stack-tight">
        <h3>Por dónde entraron</h3>
        <Bars
          rows={data.byChannel.map((c) => ({ label: CHANNEL_LABELS[c.channel], total: c.total }))}
        />
      </div>

      <div className="card stack-tight">
        <h3>Demoras por óptica</h3>
        <table className="report">
          <thead>
            <tr>
              <th>Óptica</th>
              <th className="num">En curso</th>
              <th className="num">Pares</th>
              <th className="num">Demorados</th>
            </tr>
          </thead>
          <tbody>
            {data.byOptician.map((o) => (
              <tr key={o.optician}>
                <td>{o.optician}</td>
                <td className="num">{o.total}</td>
                <td className="num">{o.pairs}</td>
                <td className={o.overdue > 0 ? 'num late' : 'num'}>{o.overdue}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">Cuenta sólo mientras el expediente está en manos de la óptica.</p>
      </div>

      <div className="card stack-tight">
        <div className="row between">
          <h3>Por barrio</h3>
          <label className="check">
            <input
              type="checkbox"
              checked={shareable}
              onChange={(e) => setShareable(e.target.checked)}
            />
            Vista para compartir
          </label>
        </div>
        <table className="report">
          <thead>
            <tr>
              <th>Barrio</th>
              <th className="num">Abiertos</th>
              <th className="num">Entregados</th>
              <th className="num">Demorados</th>
            </tr>
          </thead>
          <tbody>
            {data.byNeighborhood.map((n) => (
              <tr key={n.neighborhood}>
                <td>{n.neighborhood}</td>
                <td className="num">{n.open ?? <span className="masked">&lt;3</span>}</td>
                <td className="num">{n.delivered ?? <span className="masked">&lt;3</span>}</td>
                <td className="num">{n.overdue ?? <span className="masked">&lt;3</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          {shareable
            ? 'Los valores de uno y dos se muestran como “<3”: en un barrio chico, un 1 alcanza para saber de quién se habla. Es la versión que puede salir hacia el sistema del municipio.'
            : 'Vista interna. Al compartir estos números afuera se ocultan los valores chicos y nunca salen nombres.'}
        </p>
      </div>
    </div>
  );
}

function DeliveriesView({ onOpen }: { onOpen: (caseId: string) => void }) {
  const { data, error } = useReport<DeliveriesReport>(() => api.deliveriesReport(), []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando el padrón…</p>;

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi
          value={data.totals.pairs}
          label="Pares entregados"
          hint={`En ${data.totals.deliveries} entregas`}
        />
        <Kpi
          value={data.totals.byRepresentative}
          label="Recibidas por representante"
          hint="Con nombre y vínculo"
        />
        <Kpi
          value={data.totals.unverifiedIdentity}
          label="Sin identidad verificada"
          hint="Entraron por el formulario público"
        />
      </div>

      <div className="card stack-tight">
        <table className="report">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Expediente</th>
              {data.nominal && <th>Persona</th>}
              <th className="num">Pares</th>
              <th>Barrio</th>
              <th>Recibió</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.caseId}>
                <td className="num">{formatDate(r.deliveredAt)}</td>
                <td>
                  <button type="button" className="link" onClick={() => onOpen(r.caseId)}>
                    {r.code}
                  </button>
                </td>
                {data.nominal && (
                  <td>
                    {r.person?.name}
                    <span className="muted"> · {formatDni(r.person?.dni ?? '')}</span>
                  </td>
                )}
                <td className="num">{r.pairs}</td>
                <td>{r.neighborhood ?? '—'}</td>
                <td>{r.receivedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && <p className="muted">Todavía no hay entregas registradas.</p>}
        <p className="muted">
          Es el respaldo del total de entregas: cada par tiene detrás un expediente y quién lo
          recibió.
          {!data.nominal && ' Tu rol ve la entrega y su respaldo, sin la identidad de la persona.'}
        </p>
      </div>
    </div>
  );
}

function PendingView({ onOpen }: { onOpen: (caseId: string) => void }) {
  const { data, error } = useReport<PendingReport>(() => api.pendingReport(), []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Cargando…</p>;

  const rowsTable = (rows: PendingReport['byNeighborhood'][number]['rows']) => (
    <table className="report">
      <thead>
        <tr>
          <th>Expediente</th>
          {data.nominal && <th>Persona</th>}
          <th className="num">Pares</th>
          <th>Etapa</th>
          <th className="num">Días</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.caseId}>
            <td>
              <button type="button" className="link" onClick={() => onOpen(r.caseId)}>
                {r.code}
              </button>
            </td>
            {data.nominal && <td>{r.person?.name}</td>}
            <td className="num">{r.pairs}</td>
            <td>
              {STAGE_LABELS[r.stage]}
              {r.hold && <span className="chip hold">{HOLD_LABELS[r.hold]}</span>}
            </td>
            <td className={r.overdue ? 'num late' : 'num'}>
              {Math.floor((Date.now() - new Date(r.stageSince).getTime()) / 86_400_000)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="stack">
      <div className="kpis">
        <Kpi
          value={data.totals.inHousePairs}
          label="Pares en el municipio"
          hint={`${data.totals.inHouseCases} expedientes sin entregar`}
        />
        <Kpi
          value={data.totals.atOpticianPairs}
          label="Pares en la óptica"
          hint={`${data.totals.atOpticianCases} todavía en producción`}
        />
        <Kpi value={data.totals.overdue} label="Fuera de plazo" hint="Entre los dos grupos" />
      </div>

      {data.byNeighborhood.length === 0 && (
        <p className="muted">No hay anteojos esperando entrega en el municipio.</p>
      )}
      {data.byNeighborhood.map((g) => (
        <div className="card stack-tight" key={g.neighborhood}>
          <h3>
            {g.neighborhood} <span className="muted">· {g.pairs} pares</span>
          </h3>
          {rowsTable(g.rows)}
        </div>
      ))}

      {data.atOptician.length > 0 && (
        <div className="card stack-tight">
          <h3>Todavía en la óptica</h3>
          {rowsTable(data.atOptician)}
        </div>
      )}
      <p className="muted">
        Con esto se arma la próxima jornada de entrega: qué hay que entregar y en qué barrio.
      </p>
    </div>
  );
}

function PersonView({ onOpen }: { onOpen: (caseId: string) => void }) {
  const [q, setQ] = useState('');
  const [reason, setReason] = useState('');
  const [sent, setSent] = useState('');
  const { data, error } = useReport<PersonReport[]>(
    () => (sent.length >= 3 ? api.personReport(sent, reason) : Promise.resolve([])),
    [sent],
  );

  return (
    <div className="stack">
      <div className="card stack-tight">
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(q.trim());
          }}
        >
          <div className="row">
            <input
              value={q}
              placeholder="DNI o apellido, con o sin acentos"
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Motivo de la consulta…</option>
              <option>Consulta del vecino</option>
              <option>Verificar una entrega</option>
              <option>Reclamo</option>
              <option>Auditoría</option>
            </select>
            <button type="submit">Buscar</button>
          </div>
        </form>
        <p className="muted">
          Junta todas las solicitudes de la misma persona, aunque hayan entrado por canales
          distintos. Cada consulta queda registrada: quién, cuándo y por qué.
        </p>
      </div>

      {error && <p className="error">{error}</p>}
      {sent.length >= 3 && data?.length === 0 && (
        <p className="muted">No hay nadie con ese DNI ni ese apellido.</p>
      )}

      {data?.map((p) => (
        <div className="card stack-tight" key={p.id}>
          <div className="case-head">
            <h3>{p.name}</h3>
            <span className="chip">DNI {formatDni(p.dni)}</span>
            {p.neighborhood && <span className="chip">{p.neighborhood}</span>}
            {!p.identityVerified && <span className="chip hold">Identidad por verificar</span>}
          </div>
          <p className="muted">
            {p.deliveredPairs} {p.deliveredPairs === 1 ? 'par entregado' : 'pares entregados'} ·{' '}
            {p.openPairs} en curso · {p.cases.length}{' '}
            {p.cases.length === 1 ? 'solicitud' : 'solicitudes'}
          </p>
          <table className="report">
            <thead>
              <tr>
                <th>Expediente</th>
                <th>Pedido</th>
                <th className="num">Pares</th>
                <th>Etapa</th>
                <th>Entrega</th>
              </tr>
            </thead>
            <tbody>
              {p.cases.map((c) => (
                <tr key={c.caseId}>
                  <td>
                    <button type="button" className="link" onClick={() => onOpen(c.caseId)}>
                      {c.code}
                    </button>
                  </td>
                  <td>
                    {formatDate(c.createdAt)}
                    <span className="muted"> · {CHANNEL_LABELS[c.channel]}</span>
                  </td>
                  <td className="num">{c.pairs}</td>
                  <td>
                    {STAGE_LABELS[c.stage]}
                    {c.overdue && <span className="chip hold">Demorado</span>}
                  </td>
                  <td>
                    {c.delivery
                      ? `${formatDate(c.delivery.deliveredAt)} · ${c.delivery.receivedBy}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
