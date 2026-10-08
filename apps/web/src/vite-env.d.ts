/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" sólo en la versión de demostración, que corre sin servidor. */
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
