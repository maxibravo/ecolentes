import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // La versión de demostración se publica desde una carpeta cualquiera, así que
  // las rutas de los archivos tienen que ser relativas.
  base: process.env.VITE_DEMO === '1' ? './' : '/',
  build:
    process.env.VITE_DEMO === '1'
      ? // Un solo archivo de JavaScript, para poder publicarla como una página
        // suelta sin depender de cómo se sirvan los archivos de al lado.
        { rollupOptions: { output: { inlineDynamicImports: true } } }
      : {},
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.WEB_API_URL ?? 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
