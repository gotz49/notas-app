// ============================================================
//  SERVICIO DE NOTAS  (CRUD + papelera + sincronizacion en vivo)
// ------------------------------------------------------------
//  Toda operacion sobre la tabla "notes" pasa por aca.
//  CRUD = Create, Read, Update, Delete (crear, leer, editar, borrar).
//
//  Este archivo NO guarda estado ni sabe de React: solo habla con
//  Supabase y devuelve datos o tira errores. El estado vive en
//  hooks/useNotes.ts. No hace falta filtrar por usuario: las
//  politicas RLS de supabase/schema.sql ya lo garantizan.
// ============================================================
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Note, NoteKind, NoteUpdate, RemoteNoteChange } from "../types";
import { gastosInicial, serializeGastos } from "../lib/gastos";
import { pesoInicial, serializePeso } from "../lib/peso";

// Columnas que pedimos siempre (mejor que "*": si algun dia se agrega una
// columna pesada a la tabla, no la traemos sin querer). Si cambias
// supabase/schema.sql, actualiza esta lista y el tipo Note.
const COLUMNS = "id, user_id, kind, title, content, pinned, keywords, deleted_at, created_at, updated_at";

// ---------- Errores propios ----------

// Otro dispositivo guardo esta nota despues de que la abrimos: guardar
// ahora pisaria sus cambios. Lo maneja utils/autosaveQueue.ts.
export class NoteConflictError extends Error {
  constructor(public readonly noteId: string) {
    super("La nota fue modificada en otro dispositivo.");
    this.name = "NoteConflictError";
  }
}

// La nota ya no existe (se borro definitivamente en otro lado).
export class NoteNotFoundError extends Error {
  constructor(public readonly noteId: string) {
    super("La nota ya no existe.");
    this.name = "NoteNotFoundError";
  }
}

// ---------- READ ----------

// Trae TODAS las notas del usuario, incluidas las de la papelera (la app
// las separa en pantalla). El orden final lo decide utils/notes.ts.
export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(COLUMNS)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Note[];
}

// Trae una sola nota (o null si no existe).
export async function fetchNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from("notes").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Note | null;
}

// ---------- CREATE ----------
// Crear una nota vacia para el usuario indicado. Segun `kind` arranca
// como nota normal (HTML vacio), de gastos (JSON con una lista) o de peso
// (JSON con la lista de registros vacia).
const TITULO_INICIAL: Record<NoteKind, string> = {
  nota: "Sin titulo",
  gastos: "Gastos",
  peso: "Peso",
};
function contenidoInicial(kind: NoteKind): string {
  if (kind === "gastos") return serializeGastos(gastosInicial());
  if (kind === "peso") return serializePeso(pesoInicial());
  return "";
}
export async function createNote(userId: string, kind: NoteKind = "nota"): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({
      user_id: userId,
      kind,
      title: TITULO_INICIAL[kind],
      content: contenidoInicial(kind),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Note;
}

// ---------- UPDATE ----------

// Guarda titulo / contenido / keywords (lo usa el autoguardado).
//
// "expectedUpdatedAt" es la version de la nota sobre la que el usuario
// estaba escribiendo. El UPDATE solo se aplica si la nota en la base sigue
// en esa version ("control de concurrencia optimista"). Si otro
// dispositivo la cambio en el medio, no se actualiza ninguna fila y se
// tira NoteConflictError en vez de pisar sus cambios.
// Con expectedUpdatedAt = null se guarda sin chequear ("sobrescribir").
export async function saveNote(
  id: string,
  changes: NoteUpdate,
  expectedUpdatedAt: string | null
): Promise<Note> {
  let query = supabase.from("notes").update(changes).eq("id", id);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);

  const { data, error } = await query.select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (data) return data as Note;

  // No se actualizo nada: ¿cambio la version o la nota ya no existe?
  const current = await fetchNote(id);
  if (!current) throw new NoteNotFoundError(id);
  throw new NoteConflictError(id);
}

// Fijar / desfijar arriba de la lista. (No cambia updated_at: ver schema.sql)
export function setPinned(id: string, pinned: boolean): Promise<Note> {
  return updateMeta(id, { pinned });
}

// ---------- PAPELERA ----------
// "Borrar" manda la nota a la papelera (deleted_at = ahora) y se puede
// restaurar. Solo "Borrar para siempre" la elimina de verdad.

export function moveToTrash(id: string): Promise<Note> {
  return updateMeta(id, { deleted_at: new Date().toISOString() });
}

export function restoreFromTrash(id: string): Promise<Note> {
  return updateMeta(id, { deleted_at: null });
}

// DELETE definitivo de una nota (no se puede deshacer).
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) throw error;
}

// DELETE definitivo de todas las notas de la papelera.
export async function emptyTrash(): Promise<void> {
  const { error } = await supabase.from("notes").delete().not("deleted_at", "is", null);
  if (error) throw error;
}

async function updateMeta(id: string, changes: { pinned?: boolean; deleted_at?: string | null }): Promise<Note> {
  const { data, error } = await supabase.from("notes").update(changes).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) throw error;
  if (!data) throw new NoteNotFoundError(id);
  return data as Note;
}

// ---------- REALTIME ----------

export type NotesSubscriptionHandlers = {
  // Llega un cambio (de otro dispositivo, o el eco de uno nuestro).
  onChange: (change: RemoteNoteChange) => void;
  // Se (re)conecto el canal. Si estuvimos desconectados pudimos
  // perdernos cambios, asi que conviene recargar la lista.
  onConnected: () => void;
};

// Escucha cambios de la tabla "notes" en vivo. Cada cambio se aplica
// directo a la lista (sin volver a pedir todas las notas).
// Devuelve una funcion para "desuscribirse" cuando ya no se necesita.
//
//  - INSERT y UPDATE se filtran por user_id (RLS tambien lo garantiza; el
//    filtro ahorra trabajo al servidor).
//  - DELETE no se puede filtrar en Supabase: llegan solo con el id de la
//    fila borrada (sin contenido), asi que no exponen datos ajenos; si el
//    id no esta en nuestra lista, simplemente no pasa nada.
export function subscribeToNotes(userId: string, handlers: NotesSubscriptionHandlers): () => void {
  const emit = (payload: RealtimePostgresChangesPayload<Note>) => {
    if (payload.eventType === "DELETE") {
      const id = (payload.old as Partial<Note>).id;
      if (id) handlers.onChange({ type: "delete", id });
      return;
    }
    handlers.onChange({ type: "upsert", note: payload.new as Note });
  };
  const filter = `user_id=eq.${userId}`;

  const channel = supabase
    .channel(`notes:${userId}`)
    .on<Note>("postgres_changes", { event: "INSERT", schema: "public", table: "notes", filter }, emit)
    .on<Note>("postgres_changes", { event: "UPDATE", schema: "public", table: "notes", filter }, emit)
    .on<Note>("postgres_changes", { event: "DELETE", schema: "public", table: "notes" }, emit)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") handlers.onConnected();
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
