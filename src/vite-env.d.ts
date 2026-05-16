/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_WTS_TOKEN_ESTUDIO_MAIS: string;
  readonly VITE_INFOSOFT_API_BASE?: string;
  readonly VITE_INFOSOFT_API_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
