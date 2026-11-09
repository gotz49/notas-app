// ============================================================
//  Logica pura de la lista de notas
// ------------------------------------------------------------
//  Funciones sin efectos (no tocan React ni Supabase): reciben
//  datos y devuelven datos nuevos. Por eso son faciles de testear
//  (ver notes.test.ts) y las usa el hook useNotes.
// ============================================================
import type { Note, RemoteNoteChange } from "../types";
import { normalize, toPlainText } from "./text";
import { textoBuscableGastos } from "../lib/gastos";

// ---------- Versiones (updated_at) ----------
// Postgres guarda microsegundos ("2026-11-04T10:00:00.123456+00:00")
// pero Date de JavaScript solo milisegundos. Para comparar versiones
// sin perder precision convertimos a microsegundos (BigInt).
const ISO_RE = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.(\d+))?(Z|[+-]\d{2}(?::?\d{2})?)?$/;

export function toMicros(iso: string): bigint {
  const m = ISO_RE.exec(iso.trim());
  if (!m) return BigInt(Date.parse(iso) || 0) * 1000n;
  const [, base, fraction = "", zone = "Z"] = m;
  const seconds = Date.parse(`${base.replace(" ", "T")}${normalizeZone(zone)}`);
  const micros = Number((fraction + "000000").slice(0, 6));
  return BigInt(seconds) * 1000n + BigInt(micros);
}

// "+00" -> "+00:00", "+0300" -> "+03:00", "Z" -> "Z"
function normalizeZone(zone: string): string {
  if (zone === "Z") return "Z";
  if (zone.length === 3) return `${zone}:00`;
  if (zone.includes(":")) return zone;
  return `${zone.slice(0, 3)}:${zone.slice(3)}`;
}

// true si la version "a" es posterior a "b".
export function isNewer(a: string, b: string | null | undefined): boolean {
  if (!b) return true;
  return toMicros(a) > toMicros(b);
}

// ---------- Cambios en vivo ----------
// Aplica un cambio de Realtime a la lista. Regla clave: NUNCA volver a
// una version mas vieja. Puede pasar que el "eco" de un guardado anterior
// llegue despues de la respuesta de un guardado mas nuevo; si lo
// aplicaramos, la lista mostraria texto viejo.
export function applyRemoteChange(notes: Note[], change: RemoteNoteChange): Note[] {
  if (change.type === "delete") return notes.filter((n) => n.id !== change.id);
  const incoming = change.note;
  const current = notes.find((n) => n.id === incoming.id);
  if (!current) return [incoming, ...notes];
  if (isNewer(current.updated_at, incoming.updated_at)) return notes; // llego algo viejo: ignorar
  return notes.map((n) => (n.id === incoming.id ? incoming : n));
}

// Inserta o reemplaza una nota (respuesta directa del servidor).
export function upsertNote(notes: Note[], note: Note): Note[] {
  return notes.some((n) => n.id === note.id)
    ? notes.map((n) => (n.id === note.id ? note : n))
    : [note, ...notes];
}

// Modifica campos de una nota localmente (antes de que confirme el servidor).
export function patchNote(notes: Note[], id: string, changes: Partial<Note>): Note[] {
  return notes.map((n) => (n.id === id ? { ...n, ...changes } : n));
}

// ---------- Vistas ----------
export type NotesView = "notes" | "trash";

// Devuelve las notas a mostrar en la barra lateral:
//  - "notes": las que no estan en la papelera, fijadas primero y
//    luego por ultima edicion.
//  - "trash": las de la papelera, la mas recientemente borrada primero.
// Ademas filtra por el texto de busqueda (titulo + contenido + keywords,
// sin importar mayusculas ni tildes).
export function selectVisibleNotes(notes: Note[], view: NotesView, query: string): Note[] {
  const q = normalize(query.trim());
  const inView = notes.filter((n) => (view === "trash" ? n.deleted_at !== null : n.deleted_at === null));
  const matching = q
    ? inView.filter((n) =>
        normalize(`${n.title} ${textoBuscable(n)} ${n.keywords}`).includes(q)
      )
    : inView;

  return [...matching].sort((a, b) => {
    if (view === "trash") return compareDesc(a.deleted_at, b.deleted_at);
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return compareDesc(a.updated_at, b.updated_at);
  });
}

// Texto del contenido para buscar. Las notas de gastos guardan JSON: se
// busca solo en titulos de listas y conceptos, no en las claves del JSON.
function textoBuscable(n: Note): string {
  if (n.kind === "gastos") return textoBuscableGastos(n.content);
  return toPlainText(n.content);
}

// Orden descendente (mas nuevo primero); los valores vacios van al final.
function compareDesc(a: string | null, b: string | null): number {
  if (!a || !b) return a ? -1 : b ? 1 : 0;
  const diff = toMicros(b) - toMicros(a);
  return diff > 0n ? 1 : diff < 0n ? -1 : 0;
}

export function countTrash(notes: Note[]): number {
  return notes.filter((n) => n.deleted_at !== null).length;
}
