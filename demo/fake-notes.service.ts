/* eslint-disable */
// ============================================================
//  Backend FALSO en memoria (solo para "npm run dev:demo").
//  Imita a src/services/notes.service.ts: mismas funciones, mismos
//  errores, y simula Realtime (el "eco" llega 250 ms despues).
//  Ver demo/vite.config.ts para los controles de la consola.
// ============================================================
import { gastosInicial, serializeGastos } from "../src/lib/gastos";
import { pesoInicial, serializePeso } from "../src/lib/peso";

type Note = any;

export class NoteConflictError extends Error {
  constructor(public noteId: string) {
    super("conflict");
    this.name = "NoteConflictError";
  }
}
export class NoteNotFoundError extends Error {
  constructor(public noteId: string) {
    super("not found");
    this.name = "NoteNotFoundError";
  }
}

let counter = 0;
function version(): string {
  counter++;
  const iso = new Date().toISOString().slice(0, 19);
  return `${iso}.${String(100000 + counter).slice(-6)}+00:00`;
}

const base = { user_id: "u1", pinned: false, keywords: "", deleted_at: null };
const notes: Note[] = [
  {
    ...base,
    id: "n1",
    kind: "nota",
    title: "Bienvenida",
    keywords: "RLS: seguridad por fila en Supabase",
    content:
      '<h1>Hola</h1><p>Nota de <strong>prueba</strong> con un <a href="https://ejemplo.com">link</a>.</p><ul data-type="taskList"><li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>tarea pendiente</p></div></li></ul><p>Entrega: <span data-type="date" data-value="2026-11-04">4 nov 2026</span> Estado: <span data-type="dropdown" data-value="En curso" data-options=\'["Pendiente","En curso","Listo"]\'>En curso</span></p>',
    created_at: version(),
    updated_at: version(),
  },
  {
    ...base,
    id: "n2",
    kind: "gastos",
    title: "Gastos noviembre",
    pinned: true,
    content: serializeGastos({
      listas: [{ id: "l1", titulo: "Servicios", renglones: [{ id: "r1", pagado: true, concepto: "Luz", monto: 15000 }, { id: "r2", pagado: false, concepto: "Internet", monto: 22000 }] }],
    }),
    created_at: version(),
    updated_at: version(),
  },
  {
    ...base,
    id: "n3",
    kind: "peso",
    title: "Peso",
    content: serializePeso({ registros: [{ id: "p1", fecha: "2026-11-03", peso: 80.2 }, { id: "p2", fecha: "2026-11-04", peso: 79.9 }] }),
    created_at: version(),
    updated_at: version(),
  },
  {
    ...base,
    id: "n4",
    kind: "nota",
    title: "Nota vieja borrada",
    content: "<p>chau</p>",
    deleted_at: new Date().toISOString(),
    created_at: version(),
    updated_at: version(),
  },
];

const listeners = new Set<any>();
const fake = {
  notes,
  offline: false,
  saves: 0,
  remoteEdit(id: string, changes: Record<string, unknown>) {
    const n = notes.find((x) => x.id === id);
    Object.assign(n, changes);
    n.updated_at = version();
    emit(n);
  },
};
(window as any).__fake = fake;

const wait = () => new Promise((r) => setTimeout(r, 120));
const copy = (n: Note) => ({ ...n });
function emit(n: Note) {
  const c = copy(n);
  setTimeout(() => listeners.forEach((l) => l.onChange({ type: "upsert", note: c })), 250);
}
function check() {
  if (fake.offline) throw new Error("Failed to fetch");
}

export async function fetchNotes() {
  await wait();
  check();
  return notes.map(copy);
}
export async function fetchNote(id: string) {
  await wait();
  check();
  const n = notes.find((x) => x.id === id);
  return n ? copy(n) : null;
}
export async function createNote(userId: string, kind = "nota") {
  await wait();
  check();
  const v = version();
  const content = kind === "gastos" ? serializeGastos(gastosInicial()) : kind === "peso" ? serializePeso(pesoInicial()) : "";
  const title = kind === "gastos" ? "Gastos" : kind === "peso" ? "Peso" : "Sin titulo";
  const n = { ...base, id: `n${Date.now()}`, user_id: userId, kind, title, content, created_at: v, updated_at: v };
  notes.unshift(n);
  emit(n);
  return copy(n);
}
export async function saveNote(id: string, changes: any, expected: string | null) {
  await wait();
  check();
  const n = notes.find((x) => x.id === id);
  if (!n) throw new NoteNotFoundError(id);
  if (expected && n.updated_at !== expected) throw new NoteConflictError(id);
  Object.assign(n, changes);
  n.updated_at = version();
  fake.saves++;
  emit(n);
  return copy(n);
}
async function meta(id: string, changes: any) {
  await wait();
  check();
  const n = notes.find((x) => x.id === id);
  if (!n) throw new NoteNotFoundError(id);
  Object.assign(n, changes); // como el trigger: NO cambia updated_at
  emit(n);
  return copy(n);
}
export const setPinned = (id: string, pinned: boolean) => meta(id, { pinned });
export const moveToTrash = (id: string) => meta(id, { deleted_at: new Date().toISOString() });
export const restoreFromTrash = (id: string) => meta(id, { deleted_at: null });
export async function deleteNote(id: string) {
  await wait();
  check();
  const i = notes.findIndex((x) => x.id === id);
  if (i >= 0) notes.splice(i, 1);
}
export async function emptyTrash() {
  await wait();
  check();
  for (let i = notes.length - 1; i >= 0; i--) if (notes[i].deleted_at) notes.splice(i, 1);
}
export function subscribeToNotes(_userId: string, handlers: any) {
  listeners.add(handlers);
  setTimeout(() => handlers.onConnected(), 50);
  return () => listeners.delete(handlers);
}
