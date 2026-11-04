/// <reference types="vite/client" />

// Tipos de las variables de entorno (archivo .env). Asi TypeScript sabe
// que existen y que son texto, y autocompleta import.meta.env.VITE_...
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
