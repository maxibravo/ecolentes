import { useEffect, useState } from 'react';

type Health = { status: string; service: string };

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/v1/health')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setHealth)
      .catch(() => setError(true));
  }, []);

  return (
    <main>
      <h1>Ecolentes</h1>
      <p>Sistema de salud territorial · Dirección de Salud, San Miguel de Tucumán</p>
      <p className="state">
        {health ? 'Conectado con la API.' : error ? 'Sin conexión con la API.' : 'Conectando…'}
      </p>
    </main>
  );
}
