/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" sólo en la versión de demostración, que corre sin servidor. */
  readonly VITE_DEMO?: string;
  /** Ruta de la API cuando la aplicación cuelga de un prefijo, por ejemplo "/ecolentes/api". */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
