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
