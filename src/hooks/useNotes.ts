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
import * as imagesService from "../services/images.service";

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

  // Borrar una nota. Antes leemos su contenido (desde el estado actual, via
  // el updater para no depender de un closure viejo) para despues limpiar sus
  // imagenes del Storage y no dejar archivos huerfanos ocupando cuota.
  const remove = useCallback(async (id: string) => {
    let contenido = "";
    setNotes((prev) => {
      contenido = prev.find((n) => n.id === id)?.content ?? "";
      return prev.filter((n) => n.id !== id);
    });
    await notesService.deleteNote(id);
    // Best-effort: si falla la limpieza, la nota igual quedo borrada.
    void imagesService.deleteNoteImages(contenido).catch(() => {});
  }, []);

  // Subir una imagen y obtener su URL publica (para insertarla en el editor).
  const uploadImage = useCallback(
    async (file: File) => {
      if (!userId) throw new Error("No hay usuario.");
      return imagesService.uploadNoteImage(file, userId);
    },
    [userId]
  );

  return { notes, loading, create, update, remove, uploadImage };
}
