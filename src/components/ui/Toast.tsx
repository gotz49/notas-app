// ============================================================
//  Toast: aviso temporal abajo de la pantalla, con accion opcional
//  (ej. "Nota movida a la papelera · Deshacer").
//
//  Uso:
//    const toast = useToast();
//    toast.show({ message: "Listo", action: { label: "Deshacer", run } });
//    <Toast toast={toast.current} onClose={toast.dismiss} />
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

export type ToastData = {
  message: string;
  tone?: "info" | "error";
  action?: { label: string; run: () => void };
};

const AUTO_HIDE_MS = 6000;

export function useToast() {
  const [current, setCurrent] = useState<(ToastData & { id: number }) | null>(null);
  const nextId = useRef(0);

  const show = useCallback((data: ToastData) => {
    nextId.current += 1;
    setCurrent({ ...data, id: nextId.current });
  }, []);
  const dismiss = useCallback(() => setCurrent(null), []);

  // Atajo para errores: muestra el mensaje en rojo.
  const error = useCallback((message: string) => show({ message, tone: "error" }), [show]);

  return { current, show, error, dismiss };
}

export function Toast({ toast, onClose }: { toast: (ToastData & { id: number }) | null; onClose: () => void }) {
  // Se oculta solo despues de unos segundos (se reinicia con cada aviso nuevo).
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    <div
      className={`${styles.toast} ${toast.tone === "error" ? styles.error : ""}`}
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.run();
            onClose();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" className={styles.close} aria-label="Cerrar aviso" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
