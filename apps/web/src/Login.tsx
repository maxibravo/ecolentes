import { useState, type FormEvent } from 'react';
import { api, writeToken, type SessionUser } from './lib/api';

export function Login({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      const result = await api.login(username, password);
      writeToken(result.accessToken);
      onLogin(result.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo entrar');
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>Ecolentes</h1>
      <p className="muted">Dirección de Salud · San Miguel de Tucumán</p>

      <label htmlFor="username">Usuario</label>
      <input
        id="username"
        value={username}
        autoComplete="username"
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label htmlFor="password">Contraseña</label>
      <input
        id="password"
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && <p className="error">{error}</p>}

      <button type="submit" disabled={sending}>
        {sending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
