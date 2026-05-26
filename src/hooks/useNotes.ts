// ============================================================
//  HOOK useNotes
// ------------------------------------------------------------
//  Maneja TODO el estado de las notas: cargarlas, crear, editar,
//  borrar y mantenerlas sincronizadas en tiempo real entre
//  dispositivos. Los componentes solo llaman estas funciones.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import type { Note, NoteUpdate } from "../types";
import * as notesService from "../services/notes.service";

export function useNotes(userId: string | undefined) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Recargar la lista desde la base de datos.
  const reload = useCallback(async () => {
    const data = await notesService.fetchNotes();
    setNotes(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!userId) return;
    reload();

    // Sincronizacion en vivo: si otro dispositivo cambia algo,
    // recargamos la lista automaticamente.
    const unsubscribe = notesService.subscribeToNotes(reload);
    return unsubscribe;
  }, [userId, reload]);

  // Crear una nota nueva y devolverla (para abrirla al instante).
  const create = useCallback(async () => {
    if (!userId) return undefined;
    const nota = await notesService.createNote(userId);
    setNotes((prev) => [nota, ...prev]); // optimista: la mostramos ya
    return nota;
  }, [userId]);

  // Editar una nota. Actualizamos la pantalla al instante (optimista)
  // y dejamos que el servidor confirme por detras.
  const update = useCallback(async (id: string, changes: NoteUpdate) => {
    setNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, ...changes } : n))
    );
    await notesService.updateNote(id, changes);
  }, []);

  // Borrar una nota.
  const remove = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await notesService.deleteNote(id);
  }, []);

  return { notes, loading, create, update, remove };
}
