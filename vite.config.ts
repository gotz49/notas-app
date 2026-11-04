/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuracion de Vite (el "bundler" que compila y sirve la app en desarrollo).
// El plugin de React habilita JSX y el refresco en caliente (hot reload).
export default defineConfig({
  plugins: [react()],
  // En GitHub Pages la app se sirve bajo /notas-app/ (no en la raiz del dominio),
  // asi que las rutas a los assets deben llevar ese prefijo en produccion.
  // En desarrollo tambien se usa: la app queda en http://localhost:5173/notas-app/
  base: "/notas-app/",
  build: {
    // El editor (TipTap/ProseMirror) y Supabase pesan ~1 MB sin comprimir
    // (~330 KB con gzip, que es lo que viaja por la red). Es razonable para
    // esta app; subimos el limite del aviso para que no moleste en cada build.
    chunkSizeWarningLimit: 1200,
  },
  // Tests automaticos (npm test). jsdom simula un navegador.
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Fija la zona horaria para que los tests de fechas den igual en
    // cualquier computadora (y en GitHub).
    env: { TZ: "America/Argentina/Buenos_Aires" },
  },
});
