import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

function render() {
  createRoot(container!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// La versión de demostración trae un servidor de mentira dentro del navegador.
// En el build normal esta rama se descarta entera y el código ni se descarga.
if (import.meta.env.VITE_DEMO === '1') {
  void import('./demo/backend').then(({ installDemoBackend }) => {
    installDemoBackend();
    render();
  });
} else {
  render();
}
