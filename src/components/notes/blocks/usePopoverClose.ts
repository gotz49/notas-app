import { useEffect, type RefObject } from "react";

// Cierra un popover al hacer clic afuera o con Escape. El Escape se escucha en
// fase de captura y detiene la propagacion: asi solo cierra el popover y no
// dispara ademas el "volver al inicio" global de App.
export function usePopoverClose(ref: RefObject<HTMLElement>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [ref, open, onClose]);
}
