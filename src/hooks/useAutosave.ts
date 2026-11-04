// ============================================================
//  HOOK useAutosave
// ------------------------------------------------------------
//  Conecta la cola de autoguardado (utils/autosaveQueue.ts) con
//  React y con el navegador:
//   - expone el estado ("Guardando…", "Guardado", error, conflicto)
//     y se re-renderiza cuando cambia;
//   - guarda YA cuando la pestaña se oculta (cambiar de app en el
//     celular, minimizar, cerrar);
//   - si intentas cerrar la pestaña con cambios sin guardar, el
//     navegador pregunta "¿Salir del sitio?";
//   - al volver internet, reintenta enseguida.
//
//  Se crea una vez en Workspace.tsx (y se le pasa a NoteEditor).
//  Reemplaza al debounce que antes vivia dentro de NoteEditor.
// ============================================================
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Note, NoteUpdate } from "../types";
import { AutosaveQueue } from "../utils/autosaveQueue";
import { toUserMessage } from "../utils/errors";

type Save = (id: string, changes: NoteUpdate, expectedUpdatedAt: string | null) => Promise<Note>;

export function useAutosave(save: Save) {
  // La cola se crea una sola vez (useState con funcion inicial)...
  const [queue] = useState(
    () =>
      new AutosaveQueue(save, {
        describeError: (e) => toUserMessage(e, "No se pudo guardar. Reintentando…"),
        // No reintentar lo que va a volver a fallar igual: la nota ya no
        // existe, o es mas larga que el limite de la base.
        isPermanentError: (e) =>
          (e instanceof Error && e.name === "NoteNotFoundError") ||
          /notes_(content|title)_length/.test(String((e as { message?: unknown })?.message ?? "")),
      })
  );

  // ...pero siempre usa la funcion de guardado mas reciente.
  useEffect(() => {
    queue.setSave(save);
  }, [queue, save]);

  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot);

  useEffect(() => {
    queue.start();

    const flushNow = () => void queue.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!queue.hasUnsavedChanges()) return;
      flushNow();
      e.preventDefault(); // el navegador muestra "¿Salir del sitio? Los cambios no se guardaron"
    };
    const onOnline = () => void queue.retryNow();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushNow);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
      flushNow(); // al desmontar, mandar lo ultimo que se escribio
      queue.stop();
    };
  }, [queue]);

  return { queue, ...snapshot };
}

export type Autosave = ReturnType<typeof useAutosave>;
