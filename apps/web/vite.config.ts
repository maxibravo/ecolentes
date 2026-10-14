import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El .env es uno solo y vive en la raíz del monorepo, pero Vite arranca desde
// apps/web. Lo leemos a mano, con la misma regla que usa la API: lo que ya está
// en el entorno le gana al archivo, y si no hay archivo se sigue de largo.
function cargarEnvDeLaRaiz(): void {
  const archivo = resolve(dirname(fileURLToPath(import.meta.url)), '../../.env');
  let contenido: string;
  try {
    contenido = readFileSync(archivo, 'utf8');
  } catch {
    return;
  }
  for (const linea of contenido.split('\n')) {
    if (linea.trimStart().startsWith('#')) continue;
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!match) continue;
    const [, clave, crudo] = match;
    if (process.env[clave] !== undefined) continue;
    process.env[clave] = crudo.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

cargarEnvDeLaRaiz();

export default defineConfig({
  plugins: [react()],
  // Las variables VITE_ del .env de la raíz tienen que llegar al navegador, no
  // sólo a este archivo: Vite las lee del directorio que se le diga.
  envDir: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
  /*
   * De dónde cuelga la aplicación. Servida sola es la raíz; montada adentro de
   * otro sitio, por ejemplo en /ecolentes/, hay que decirlo acá para que los
   * archivos no se pidan a la raíz del otro sitio. La demostración se publica
   * desde una carpeta cualquiera, así que ahí las rutas van relativas.
   */
  base: process.env.VITE_DEMO === '1' ? './' : (process.env.WEB_BASE_PATH ?? '/'),
  build:
    process.env.VITE_DEMO === '1'
      ? // Un solo archivo de JavaScript, para poder publicarla como una página
        // suelta sin depender de cómo se sirvan los archivos de al lado.
        { rollupOptions: { output: { inlineDynamicImports: true } } }
      : {},
  server: {
    port: Number(process.env.WEB_DEV_PORT ?? 5173),
    // Si el puerto está ocupado, Vite por omisión se corre al siguiente libre y
    // uno termina mirando la aplicación de otro proyecto en la dirección que
    // esperaba. Mejor que falle y lo diga.
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.WEB_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
