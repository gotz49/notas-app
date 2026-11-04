// ============================================================
//  HOOK useNotes
// ------------------------------------------------------------
//  Maneja TODO el estado de las notas: cargarlas, crear, guardar,
//  fijar, papelera y mantenerlas sincronizadas en tiempo real entre
//  dispositivos. Los componentes solo llaman estas funciones.
//
//  Se usa UNA vez, en Workspace.tsx, que App monta con key={user.id}:
//  si cambia el usuario se crea todo de nuevo y nunca quedan notas de
//  otra cuenta en memoria.
//
//  Sincronizacion:
//   - Al montar: trae todas las notas (fetchNotes).
//   - Realtime: cada cambio se aplica a la lista SIN volver a pedir
//     todo (applyRemoteChange en utils/notes.ts), ignorando "ecos"
//     viejos que lleguen tarde.
//   - Respaldo: el websocket se suele cortar con la pestana en segundo
//     plano o el equipo suspendido. Al reconectarse el canal, al volver
//     a la pestana o al recuperar internet, se recarga todo.
//
//  Las operaciones son "optimistas": la pantalla cambia al instante y,
//  si el servidor falla, se deshace el cambio y se tira el error para
//  que la pantalla lo muestre.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import type { Note, NoteKind, NoteUpdate } from "../types";
import * as notesService from "../services/notes.service";
import * as imagesService from "../services/images.service";
import { applyRemoteChange, patchNote, upsertNote } from "../utils/notes";
import { toUserMessage } from "../utils/errors";

export type NotesStatus = "loading" | "ready" | "error";

export function useNotes(userId: string) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<NotesStatus>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  // Numero de la ultima recarga pedida: si llegan respuestas fuera de
  // orden, solo se usa la mas reciente.
  const lastRequest = useRef(0);

  // Copia siempre actualizada de la lista, para poder deshacer cambios
  // optimistas y leer el contenido de una nota sin depender del render.
  const notesRef = useRef<Note[]>(notes);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  // ---------- Carga ----------
  const reload = useCallback(async () => {
    const requestId = ++lastRequest.current;
    try {
      const data = await notesService.fetchNotes();
      if (requestId !== lastRequest.current) return; // respuesta vieja
      setNotes(data);
      setStatus("ready");
      setLoadError(null);
    } catch (e) {
      if (requestId !== lastRequest.current) return;
      console.error("No se pudieron cargar las notas", e);
      setLoadError(toUserMessage(e, "No se pudieron cargar las notas."));
      // Si ya teniamos notas, seguimos mostrandolas (status sigue "ready").
      setStatus((prev) => (prev === "ready" ? "ready" : "error"));
    }
  }, []);

  useEffect(() => {
    void reload();

    // Realtime: aplicar cada cambio a la lista. Al RE-conectarse, recargar
    // por si hubo cambios mientras estabamos desconectados.
    let connectedOnce = false;
    const unsubscribe = notesService.subscribeToNotes(userId, {
      onChange: (change) => setNotes((prev) => applyRemoteChange(prev, change)),
      onConnected: () => {
        if (connectedOnce) void reload();
        connectedOnce = true;
      },
    });

    // Respaldo del realtime (ver comentario de arriba).
    const alVolver = () => {
      if (document.visibilityState === "visible") void reload();
    };
    const alReconectar = () => void reload();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alReconectar);

    return () => {
      // Ignorar respuestas que lleguen despues de desmontar. (Es un
      // contador, no un elemento de la pantalla: el aviso no aplica.)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      lastRequest.current++;
      unsubscribe();
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alReconectar);
    };
  }, [userId, reload]);

  // ---------- Helpers ----------

  // Aplica un cambio local ya; si la operacion falla, vuelve atras.
  const optimistic = useCallback(
    async (id: string, localChanges: Partial<Note>, run: () => Promise<Note>): Promise<Note> => {
      const before = notesRef.current.find((n) => n.id === id);
      setNotes((prev) => patchNote(prev, id, localChanges));
      try {
        const saved = await run();
        setNotes((prev) => upsertNote(prev, saved));
        return saved;
      } catch (e) {
        if (before) setNotes((prev) => upsertNote(prev, before));
        throw e;
      }
    },
    []
  );

  // ---------- Operaciones ----------

  // Crear una nota nueva y devolverla (para abrirla al instante). El `kind`
  // elige si es nota normal, de gastos o de peso.
  const create = useCallback(
    async (kind: NoteKind = "nota") => {
      const nota = await notesService.createNote(userId, kind);
      setNotes((prev) => upsertNote(prev, nota));
      return nota;
    },
    [userId]
  );

  // Guardar titulo/contenido/keywords. Lo usa el autoguardado
  // (hooks/useAutosave). No deshace el cambio local si falla: el texto
  // sigue en el editor y el autoguardado reintenta.
  const save = useCallback(async (id: string, changes: NoteUpdate, expectedUpdatedAt: string | null) => {
    setNotes((prev) => patchNote(prev, id, changes));
    const saved = await notesService.saveNote(id, changes, expectedUpdatedAt);
    setNotes((prev) => upsertNote(prev, saved));
    return saved;
  }, []);

  // Cambiar solo en pantalla (ej. el titulo mientras se escribe, para que
  // la lista lateral se actualice al instante). No guarda nada.
  const patchLocal = useCallback((id: string, changes: NoteUpdate) => {
    setNotes((prev) => patchNote(prev, id, changes));
  }, []);

  // Volver a traer una nota del servidor (ej. al resolver un conflicto).
  const refreshNote = useCallback(async (id: string) => {
    const fresh = await notesService.fetchNote(id);
    setNotes((prev) => (fresh ? upsertNote(prev, fresh) : prev.filter((n) => n.id !== id)));
    return fresh;
  }, []);

  const togglePin = useCallback(
    (id: string) => {
      const pinned = !notesRef.current.find((n) => n.id === id)?.pinned;
      return optimistic(id, { pinned }, () => notesService.setPinned(id, pinned));
    },
    [optimistic]
  );

  // Mandar a la papelera / restaurar.
  const trash = useCallback(
    (id: string) => optimistic(id, { deleted_at: new Date().toISOString() }, () => notesService.moveToTrash(id)),
    [optimistic]
  );
  const restore = useCallback(
    (id: string) => optimistic(id, { deleted_at: null }, () => notesService.restoreFromTrash(id)),
    [optimistic]
  );

  // Borrar para siempre. Despues limpiamos sus imagenes del Storage para
  // no dejar archivos huerfanos ocupando cuota (best-effort: si falla la
  // limpieza, la nota igual quedo borrada).
  const deleteForever = useCallback(async (id: string) => {
    const before = notesRef.current;
    const contenido = before.find((n) => n.id === id)?.content ?? "";
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await notesService.deleteNote(id);
    } catch (e) {
      setNotes(before);
      throw e;
    }
    void imagesService.deleteNoteImages(contenido).catch(() => {});
  }, []);

  // Vaciar la papelera (borra para siempre todas las notas de ahi).
  const emptyTrash = useCallback(async () => {
    const before = notesRef.current;
    const trashed = before.filter((n) => n.deleted_at !== null);
    setNotes((prev) => prev.filter((n) => n.deleted_at === null));
    try {
      await notesService.emptyTrash();
    } catch (e) {
      setNotes(before);
      throw e;
    }
    for (const n of trashed) void imagesService.deleteNoteImages(n.content).catch(() => {});
  }, []);

  // Subir una imagen y obtener su URL publica (para insertarla en el editor).
  const uploadImage = useCallback((file: File) => imagesService.uploadNoteImage(file, userId), [userId]);

  return {
    notes,
    status,
    loadError,
    reload,
    create,
    save,
    patchLocal,
    refreshNote,
    togglePin,
    trash,
    restore,
    deleteForever,
    emptyTrash,
    uploadImage,
  };
}

export type NotesApi = ReturnType<typeof useNotes>;
