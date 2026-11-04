// ============================================================
//  main.tsx  (punto de entrada)
// ------------------------------------------------------------
//  Aca arranca todo: React toma el <div id="root"> del index.html
//  y monta dentro el componente <App />.
//
//  1. Si faltan las claves de Supabase, muestra MissingConfig (una
//     explicacion) en vez de una pantalla en blanco.
//  2. Si estan, carga la app (import dinamico: recien ahi se crea la
//     conexion a Supabase en lib/supabase.ts).
//  ErrorBoundary envuelve toda la app: si algo falla, se ve un mensaje
//  con "Recargar" en vez de una pantalla en blanco.
// ============================================================
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { MissingConfig } from "./components/ui/MissingConfig";
import "./styles/global.css";

const root = createRoot(document.getElementById("root")!);
const configured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!configured) {
  root.render(<MissingConfig />);
} else {
  void import("./App").then(({ default: App }) => {
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  });
}

// Registra el service worker para que la app sea instalable (PWA).
// Usamos BASE_URL ("/notas-app/") porque la app se sirve bajo ese subpath
// en GitHub Pages, no en la raiz del dominio.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js");
  });
}
