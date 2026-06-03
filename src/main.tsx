// ============================================================
//  main.tsx  (punto de entrada)
// ------------------------------------------------------------
//  Aca arranca todo: React toma el <div id="root"> del index.html
//  y monta dentro el componente <App />.
// ============================================================
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Registra el service worker para que la app sea instalable (PWA).
// Usamos BASE_URL ("/notas-app/") porque la app se sirve bajo ese subpath
// en GitHub Pages, no en la raiz del dominio.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js");
  });
}
