// ============================================================
//  SERVICIO DE NOTAS  (CRUD + sincronizacion en tiempo real)
// ------------------------------------------------------------
//  Toda operacion sobre la tabla "notes" pasa por aca.
//  CRUD = Create, Read, Update, Delete (crear, leer, editar, borrar).
// ============================================================
import { supabase } from "../lib/supabase";
import type { Note, NoteKind, NoteUpdate } from "../types";
import { gastosInicial, serializeGastos } from "../lib/gastos";

// READ: traer todas las notas del usuario. Las fijadas van primero y,
// dentro de cada grupo, las mas nuevas arriba.
export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// CREATE: crear una nota vacia para el usuario indicado. Segun `kind` arranca
// como nota normal (HTML vacio) o como nota de gastos (JSON con una lista).
export async function createNote(
  userId: string,
  kind: NoteKind = "nota"
): Promise<Note> {
  const esGastos = kind === "gastos";
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      kind,
      title: esGastos ? "Gastos" : "Sin titulo",
      content: esGastos ? serializeGastos(gastosInicial()) : "",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// UPDATE: editar titulo y/o contenido de una nota.
export async function updateNote(
  id: string,
  changes: NoteUpdate
): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update(changes)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// DELETE: borrar una nota.
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

// REALTIME: escuchar cambios en la tabla "notes" en vivo.
// Devuelve una funcion para "desuscribirse" cuando ya no se necesita.
export function subscribeToNotes(onChange: () => void): () => void {
  const channel = supabase
    .channel("notes-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notes" },
      () => onChange() // ante cualquier insert/update/delete, avisamos
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
