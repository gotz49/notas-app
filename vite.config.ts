import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuracion de Vite (el "bundler" que compila y sirve la app en desarrollo).
// El plugin de React habilita JSX y el refresco en caliente (hot reload).
export default defineConfig({
  plugins: [react()],
});
