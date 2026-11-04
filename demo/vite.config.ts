// ============================================================
//  MODO DEMO  (npm run dev:demo)
// ------------------------------------------------------------
//  Levanta la app con un backend FALSO en memoria, sin Supabase ni
//  .env. Sirve para probar la interfaz rapido sin tocar datos reales.
//  Al recargar la pagina, todo vuelve al inicio (4 notas de ejemplo:
//  texto, gastos, peso y una en la papelera).
//
//  Como funciona: los "alias" reemplazan, solo en este modo, estos
//  archivos de la app por versiones falsas:
//    services/notes.service.ts  -> demo/fake-notes.service.ts
//    services/images.service.ts -> demo/fake-images.service.ts
//    services/auth.service.ts   -> demo/fake-auth.ts
//    hooks/useAuth.ts           -> demo/fake-auth.ts (usuario fijo)
//  El resto del codigo (hooks, componentes, autoguardado) es el real.
//
//  Desde la consola del navegador (F12) se puede simular:
//    __fake.offline = true                              // sin internet
//    __fake.remoteEdit("n1", { content: "<p>hola</p>" }) // edicion desde otro dispositivo
//    __fake.notes                                       // lo que hay "en el servidor"
//
//  IMPORTANTE: si agregas o cambias una funcion en notes.service.ts,
//  images.service.ts o auth.service.ts, agregala tambien en demo/.
// ============================================================
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  root: here("../"),
  plugins: [react()],
  // Claves ficticias: main.tsx exige que existan, pero en modo demo
  // nunca se usan (los servicios que hablan con Supabase son falsos).
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://demo.invalid"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("demo"),
  },
  resolve: {
    alias: [
      { find: /^.*\/services\/notes\.service$/, replacement: here("./fake-notes.service.ts") },
      { find: /^.*\/services\/images\.service$/, replacement: here("./fake-images.service.ts") },
      { find: /^.*\/services\/auth\.service$/, replacement: here("./fake-auth.ts") },
      { find: /^.*\/hooks\/useAuth$/, replacement: here("./fake-auth.ts") },
    ],
  },
  build: { chunkSizeWarningLimit: 1200 },
  server: { port: 5199 },
});
