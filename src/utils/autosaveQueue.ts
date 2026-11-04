// ============================================================
//  COLA DE AUTOGUARDADO  (sin React: se testea sola)
// ------------------------------------------------------------
//  Recibe los cambios que hace el usuario (titulo / contenido) y
//  decide CUANDO y COMO mandarlos a la base. Garantias:
//
//   1. Debounce: espera `delayMs` (600 ms) sin teclear antes de
//      guardar, para no escribir en la base en cada letra.
//   2. Acumula: varios cambios seguidos de la misma nota viajan en
//      un solo guardado. Cada nota tiene su propia "pila" de cambios
//      pendientes, asi cambiar de nota nunca pierde nada.
//   3. De a uno: nunca hay dos guardados en vuelo a la vez (evita que
//      una respuesta vieja pise a una nueva).
//   4. Reintenta: si falla (ej. sin internet), conserva los cambios y
//      reintenta con espera creciente (2s, 4s, 8s... hasta 30s).
//   5. Conflictos: cada guardado dice sobre que version ("base") se
//      escribio. Si otro dispositivo guardo en el medio, el servidor
//      rechaza el cambio y la cola queda en estado "conflict" SIN
//      pisar nada, hasta que el usuario elija que version conservar.
//
//  La pantalla lee el estado con subscribe()/getSnapshot() (lo hace
//  hooks/useAutosave.ts con useSyncExternalStore).
//  Diagrama del flujo: docs/ARQUITECTURA.md -> "Autoguardado".
// ============================================================
import type { Note, NoteUpdate } from "../types";

export type SaveStatus =
  | "idle" // nada que guardar todavia
  | "pending" // hay cambios esperando el debounce
  | "saving" // guardando ahora
  | "saved" // todo guardado
  | "error" // fallo, va a reintentar
  | "conflict"; // otro dispositivo cambio la nota: el usuario decide

export type AutosaveSnapshot = {
  status: SaveStatus;
  error: string | null; // mensaje para el usuario (status "error")
  conflictNoteId: string | null; // nota en conflicto (status "conflict")
};

// La funcion que realmente guarda (en la app: useNotes().save).
// Debe tirar un error con name "NoteConflictError" si la version no coincide.
export type SaveFn = (id: string, changes: NoteUpdate, expectedUpdatedAt: string | null) => Promise<Note>;

export type AutosaveOptions = {
  delayMs?: number;
  describeError?: (error: unknown) => string;
  // Errores que no tiene sentido reintentar (ej. la nota ya no existe).
  isPermanentError?: (error: unknown) => boolean;
};

const MAX_RETRY_MS = 30_000;

export class AutosaveQueue {
  private pending = new Map<string, NoteUpdate>(); // cambios sin enviar, por nota
  private bases = new Map<string, string>(); // version (updated_at) sobre la que se escribe, por nota
  private conflict: { id: string; changes: NoteUpdate } | null = null;
  private inFlightId: string | null = null;
  private flushing: Promise<void> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private active = true;
  private listeners = new Set<() => void>();
  private snapshot: AutosaveSnapshot = { status: "idle", error: null, conflictNoteId: null };

  private readonly delayMs: number;
  private readonly describeError: (error: unknown) => string;
  private readonly isPermanentError: (error: unknown) => boolean;

  constructor(
    private save: SaveFn,
    options: AutosaveOptions = {}
  ) {
    this.delayMs = options.delayMs ?? 600;
    this.describeError = options.describeError ?? (() => "No se pudo guardar.");
    this.isPermanentError = options.isPermanentError ?? (() => false);
  }

  // Reemplaza la funcion de guardado (React puede crear una nueva en
  // cada render; la cola siempre usa la ultima).
  setSave(save: SaveFn): void {
    this.save = save;
  }

  // ---------- Lectura de estado (para React) ----------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): AutosaveSnapshot => this.snapshot;

  // true si esta nota tiene cambios locales que todavia no estan en la
  // base (pendientes, guardandose o en conflicto). Mientras sea true, la
  // pantalla NO debe reemplazar el texto con lo que llegue del servidor.
  isBusy(id: string): boolean {
    return this.pending.has(id) || this.inFlightId === id || this.conflict?.id === id;
  }

  hasUnsavedChanges(): boolean {
    return this.pending.size > 0 || this.inFlightId !== null || this.conflict !== null;
  }

  // ---------- Versiones ----------

  // "Estoy editando esta nota a partir de la version X".
  setBase(id: string, updatedAt: string): void {
    this.bases.set(id, updatedAt);
  }

  getBase(id: string): string | undefined {
    return this.bases.get(id);
  }

  // ---------- Encolar y guardar ----------

  queue(id: string, changes: NoteUpdate): void {
    // Si la nota esta en conflicto, se siguen juntando los cambios pero
    // no se manda nada hasta que el usuario resuelva.
    if (this.conflict?.id === id) {
      this.conflict = { id, changes: { ...this.conflict.changes, ...changes } };
      return;
    }
    this.pending.set(id, { ...this.pending.get(id), ...changes });
    if (this.snapshot.status !== "error") this.setStatus("pending");
    this.restartDebounce();
  }

  // Guardar YA todo lo pendiente (de todas las notas). Se puede llamar
  // muchas veces: si ya hay un guardado corriendo, espera ese y sigue.
  flush(): Promise<void> {
    this.clearDebounce();
    if (!this.flushing) {
      this.flushing = this.runFlush().finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async runFlush(): Promise<void> {
    this.clearRetry();
    let didWork = false;
    while (this.pending.size > 0) {
      didWork = true;
      const [id, changes] = this.pending.entries().next().value as [string, NoteUpdate];
      this.pending.delete(id);
      this.inFlightId = id;
      this.setStatus("saving");
      try {
        const saved = await this.save(id, changes, this.bases.get(id) ?? null);
        this.bases.set(id, saved.updated_at);
        this.retryAttempt = 0;
      } catch (error) {
        if (isConflictError(error)) {
          // Juntamos lo que fallo con lo que se haya escrito mientras tanto.
          this.conflict = { id, changes: { ...changes, ...this.pending.get(id) } };
          this.pending.delete(id);
          this.inFlightId = null;
          this.setStatus("conflict", null, id);
          continue; // las demas notas pendientes se siguen guardando
        }
        // Devolver los cambios a la pila (los mas nuevos ganan).
        this.pending.set(id, { ...changes, ...this.pending.get(id) });
        this.inFlightId = null;
        console.error("Fallo el autoguardado", error);
        this.setStatus("error", this.describeError(error));
        if (!this.isPermanentError(error)) this.scheduleRetry();
        return;
      }
      this.inFlightId = null;
    }
    if (this.conflict) this.setStatus("conflict", null, this.conflict.id);
    else if (didWork || this.snapshot.status !== "idle") this.setStatus("saved");
  }

  // ---------- Errores y reintentos ----------

  retryNow(): Promise<void> {
    this.retryAttempt = 0;
    return this.flush();
  }

  private scheduleRetry(): void {
    if (!this.active) return;
    const wait = Math.min(MAX_RETRY_MS, 2000 * 2 ** this.retryAttempt);
    this.retryAttempt++;
    this.retryTimer = setTimeout(() => void this.flush(), wait);
  }

  // ---------- Conflictos ----------

  // "Quedarme con mi version": guarda mis cambios SIN chequear version
  // (sobrescribe lo que haya hecho el otro dispositivo).
  keepMine(): Promise<void> {
    const c = this.conflict;
    if (!c) return Promise.resolve();
    this.conflict = null;
    this.bases.delete(c.id); // sin base = guardar sin chequear
    this.pending.set(c.id, { ...c.changes, ...this.pending.get(c.id) });
    return this.flush();
  }

  // "Usar la otra version": descarta mis cambios de esa nota. La
  // pantalla despues recarga la nota desde el servidor.
  keepTheirs(): void {
    const c = this.conflict;
    if (!c) return;
    this.conflict = null;
    this.pending.delete(c.id);
    this.setStatus(this.pending.size > 0 ? "pending" : "idle");
    if (this.pending.size > 0) this.restartDebounce();
  }

  // Descartar lo pendiente de una nota (ej. se borro para siempre).
  discard(id: string): void {
    this.pending.delete(id);
    if (this.conflict?.id === id) this.conflict = null;
    if (!this.hasUnsavedChanges()) this.setStatus("idle");
  }

  // ---------- Ciclo de vida ----------

  // start/stop los llama useAutosave al montar/desmontar. stop() corta
  // los reintentos (ej. al cerrar sesion) pero no pierde lo pendiente.
  start(): void {
    this.active = true;
  }

  stop(): void {
    this.active = false;
    this.clearRetry();
  }

  // ---------- Internos ----------

  private restartDebounce(): void {
    this.clearDebounce();
    this.debounceTimer = setTimeout(() => void this.flush(), this.delayMs);
  }

  private clearDebounce(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = null;
  }

  private clearRetry(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setStatus(status: SaveStatus, error: string | null = null, conflictNoteId: string | null = null): void {
    const s = this.snapshot;
    if (s.status === status && s.error === error && s.conflictNoteId === conflictNoteId) return;
    this.snapshot = { status, error, conflictNoteId };
    this.listeners.forEach((l) => l());
  }
}

function isConflictError(error: unknown): boolean {
  return error instanceof Error && error.name === "NoteConflictError";
}
