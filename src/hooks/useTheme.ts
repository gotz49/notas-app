// ============================================================
//  HOOK useTheme
// ------------------------------------------------------------
//  Maneja el tema (claro/oscuro). Aplica el atributo data-theme
//  al <html>, lo guarda en el navegador (localStorage) y respeta
//  la preferencia del sistema operativo la primera vez.
// ============================================================
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Decide el tema inicial: lo guardado > preferencia del sistema > claro.
function getInitialTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Cada vez que cambia el tema: lo aplicamos al <html> y lo guardamos.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}