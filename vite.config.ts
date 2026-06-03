import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuracion de Vite (el "bundler" que compila y sirve la app en desarrollo).
// El plugin de React habilita JSX y el refresco en caliente (hot reload).
export default defineConfig({
  plugins: [react()],
  // En GitHub Pages la app se sirve bajo /notas-app/ (no en la raiz del dominio),
  // asi que las rutas a los assets deben llevar ese prefijo en produccion.
  // En desarrollo (vite dev) se ignora y sigue funcionando en "/".
  base: "/notas-app/",
});
