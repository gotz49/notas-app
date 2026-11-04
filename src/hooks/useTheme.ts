// ============================================================
//  HOOK useTheme
// ------------------------------------------------------------
//  Maneja el tema (claro/oscuro). Aplica el atributo data-theme
//  al <html>. El modo OSCURO es el predeterminado; solo se
//  recuerda (localStorage) cuando el usuario lo cambia a mano con
//  el boton. El script de index.html aplica lo mismo antes de que
//  cargue la app, para que no haya parpadeo.
//
//  La clave es "tema-elegido" (y no la vieja "theme") porque antes
//  se guardaba el tema en cada carga aunque nadie lo hubiera
//  elegido; con la clave nueva todos los dispositivos arrancan en
//  oscuro y solo cuenta una eleccion explicita.
// ============================================================
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export const THEME_KEY = "tema-elegido";

// Tema inicial: el que eligio el usuario, o oscuro por defecto.
function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  return saved === "light" ? "light" : "dark";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Cada vez que cambia el tema, lo aplicamos al <html>.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Cambiar a mano: se aplica y se recuerda la eleccion.
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    setTheme(next);
  };

  return { theme, toggle };
}
