import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, NoteUpdate } from "../types";
import { AutosaveQueue, type SaveFn } from "./autosaveQueue";

// Version "falsa" del servidor: guarda en memoria y cuenta versiones.
function fakeServer() {
  let version = 0;
  const calls: { id: string; changes: NoteUpdate; expected: string | null }[] = [];
  const save = vi.fn<SaveFn>(async (id, changes, expected) => {
    calls.push({ id, changes, expected });
    version++;
    return { id, updated_at: `v${version}` } as Note;
  });
  return { save, calls };
}

class Conflict extends Error {
  name = "NoteConflictError";
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("AutosaveQueue", () => {
  it("espera el debounce y junta varios cambios en un solo guardado", async () => {
    const { save, calls } = fakeServer();
    const q = new AutosaveQueue(save, { delayMs: 600 });
    q.queue("a", { title: "H" });
    q.queue("a", { title: "Ho" });
    q.queue("a", { content: "texto" });
    expect(q.getSnapshot().status).toBe("pending");
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(calls).toEqual([{ id: "a", changes: { title: "Ho", content: "texto" }, expected: null }]);
    expect(q.getSnapshot().status).toBe("saved");
  });

  it("manda la version base y la actualiza despues de cada guardado", async () => {
    const { save, calls } = fakeServer();
    const q = new AutosaveQueue(save);
    q.setBase("a", "v0");
    q.queue("a", { content: "1" });
    await q.flush();
    q.queue("a", { content: "2" });
    await q.flush();
    expect(calls.map((c) => c.expected)).toEqual(["v0", "v1"]);
  });

  it("cambiar de nota no pierde lo pendiente de la anterior", async () => {
    const { save, calls } = fakeServer();
    const q = new AutosaveQueue(save);
    q.queue("a", { content: "de A" });
    q.queue("b", { content: "de B" });
    await q.flush();
    expect(calls.map((c) => [c.id, c.changes.content])).toEqual([
      ["a", "de A"],
      ["b", "de B"],
    ]);
  });

  it("si falla, conserva los cambios, muestra error y reintenta solo", async () => {
    const { save, calls } = fakeServer();
    save.mockRejectedValueOnce(new Error("Failed to fetch"));
    const q = new AutosaveQueue(save, { describeError: () => "sin internet" });
    q.queue("a", { content: "importante" });
    await q.flush();
    expect(q.getSnapshot()).toMatchObject({ status: "error", error: "sin internet" });
    expect(q.isBusy("a")).toBe(true);
    expect(q.hasUnsavedChanges()).toBe(true);

    await vi.advanceTimersByTimeAsync(2000); // primer reintento
    expect(calls.at(-1)?.changes).toEqual({ content: "importante" });
    expect(q.getSnapshot().status).toBe("saved");
    expect(q.hasUnsavedChanges()).toBe(false);
  });

  it("lo escrito durante un error se suma (lo mas nuevo gana)", async () => {
    const { save, calls } = fakeServer();
    save.mockRejectedValueOnce(new Error("x"));
    const q = new AutosaveQueue(save);
    q.queue("a", { title: "T", content: "viejo" });
    await q.flush();
    q.queue("a", { content: "nuevo" });
    await q.flush();
    expect(calls.at(-1)?.changes).toEqual({ title: "T", content: "nuevo" });
  });

  it("no reintenta errores permanentes", async () => {
    const { save } = fakeServer();
    save.mockRejectedValue(new Error("no existe"));
    const q = new AutosaveQueue(save, { isPermanentError: () => true });
    q.queue("a", { content: "x" });
    await q.flush();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  describe("conflictos", () => {
    it("queda en conflicto sin pisar nada, y junta lo que se siga escribiendo", async () => {
      const { save } = fakeServer();
      save.mockRejectedValueOnce(new Conflict());
      const q = new AutosaveQueue(save);
      q.setBase("a", "v0");
      q.queue("a", { content: "mio 1" });
      await q.flush();
      expect(q.getSnapshot()).toMatchObject({ status: "conflict", conflictNoteId: "a" });

      q.queue("a", { content: "mio 2" }); // sigue escribiendo
      await vi.advanceTimersByTimeAsync(5000);
      expect(save).toHaveBeenCalledTimes(1); // no mando nada mas
      expect(q.isBusy("a")).toBe(true);
    });

    it("'quedarme con la mia' guarda sin chequear version", async () => {
      const { save, calls } = fakeServer();
      save.mockRejectedValueOnce(new Conflict());
      const q = new AutosaveQueue(save);
      q.setBase("a", "v0");
      q.queue("a", { content: "mio" });
      await q.flush();
      q.queue("a", { title: "titulo mio" });
      await q.keepMine();
      expect(calls.at(-1)).toEqual({ id: "a", changes: { content: "mio", title: "titulo mio" }, expected: null });
      expect(q.getSnapshot().status).toBe("saved");
    });

    it("'usar la otra version' descarta mis cambios", async () => {
      const { save } = fakeServer();
      save.mockRejectedValueOnce(new Conflict());
      const q = new AutosaveQueue(save);
      q.queue("a", { content: "mio" });
      await q.flush();
      q.keepTheirs();
      expect(q.isBusy("a")).toBe(false);
      expect(q.getSnapshot().status).toBe("idle");
    });
  });

  it("flush sin cambios no muestra 'Guardado'", async () => {
    const { save } = fakeServer();
    const q = new AutosaveQueue(save);
    await q.flush();
    expect(q.getSnapshot().status).toBe("idle");
  });
});
