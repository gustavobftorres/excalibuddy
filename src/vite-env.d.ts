/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
