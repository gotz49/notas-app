import { describe, expect, it } from "vitest";
import type { Note } from "../types";
import { applyRemoteChange, countTrash, isNewer, selectVisibleNotes, toMicros, upsertNote } from "./notes";

function note(partial: Partial<Note> & { id: string }): Note {
  return {
    user_id: "u1",
    kind: "nota",
    title: "",
    content: "",
    keywords: "",
    pinned: false,
    deleted_at: null,
    created_at: "2026-01-01T00:00:00.000000+00:00",
    updated_at: "2026-01-01T00:00:00.000000+00:00",
    ...partial,
  };
}

describe("toMicros / isNewer", () => {
  it("compara con precision de microsegundos (mas que Date)", () => {
    const a = "2026-11-04T10:00:00.123457+00:00";
    const b = "2026-11-04T10:00:00.123456+00:00";
    expect(isNewer(a, b)).toBe(true);
    expect(isNewer(b, a)).toBe(false);
  });

  it("entiende distintos formatos de zona horaria", () => {
    const z = toMicros("2026-11-04T10:00:00.5Z");
    expect(toMicros("2026-11-04T10:00:00.500000+00:00")).toBe(z);
    expect(toMicros("2026-11-04T07:00:00.5-03")).toBe(z);
    expect(toMicros("2026-11-04 10:00:00.5+0000")).toBe(z);
  });

  it("sin version anterior, cualquier version es mas nueva", () => {
    expect(isNewer("2026-01-01T00:00:00Z", undefined)).toBe(true);
  });
});

describe("applyRemoteChange", () => {
  const v1 = "2026-11-04T10:00:00.000001+00:00";
  const v2 = "2026-11-04T10:00:00.000002+00:00";

  it("agrega notas nuevas y reemplaza las existentes", () => {
    const list = [note({ id: "a", title: "vieja", updated_at: v1 })];
    const added = applyRemoteChange(list, { type: "upsert", note: note({ id: "b" }) });
    expect(added.map((n) => n.id)).toEqual(["b", "a"]);
    const updated = applyRemoteChange(list, { type: "upsert", note: note({ id: "a", title: "nueva", updated_at: v2 }) });
    expect(updated[0].title).toBe("nueva");
  });

  it("IGNORA un eco viejo que llega tarde (no vuelve atras)", () => {
    const list = [note({ id: "a", title: "lo ultimo", updated_at: v2 })];
    const result = applyRemoteChange(list, { type: "upsert", note: note({ id: "a", title: "viejo", updated_at: v1 }) });
    expect(result[0].title).toBe("lo ultimo");
  });

  it("aplica cambios con la misma version (ej. fijar, papelera)", () => {
    const list = [note({ id: "a", updated_at: v1 })];
    const result = applyRemoteChange(list, { type: "upsert", note: note({ id: "a", pinned: true, updated_at: v1 }) });
    expect(result[0].pinned).toBe(true);
  });

  it("borra por id, y no hace nada si el id no es nuestro", () => {
    const list = [note({ id: "a" })];
    expect(applyRemoteChange(list, { type: "delete", id: "a" })).toEqual([]);
    expect(applyRemoteChange(list, { type: "delete", id: "de-otro-usuario" })).toEqual(list);
  });
});

describe("upsertNote", () => {
  it("reemplaza o agrega al principio", () => {
    const list = [note({ id: "a", title: "1" })];
    expect(upsertNote(list, note({ id: "a", title: "2" }))[0].title).toBe("2");
    expect(upsertNote(list, note({ id: "b" })).map((n) => n.id)).toEqual(["b", "a"]);
  });
});

describe("selectVisibleNotes", () => {
  const notes = [
    note({ id: "vieja", title: "Compras", updated_at: "2026-01-01T00:00:00Z" }),
    note({
      id: "nueva",
      title: "Ideas",
      content: "<p>Viaje a <strong>Córdoba</strong></p>",
      keywords: "RLS: seguridad por fila",
      updated_at: "2026-03-01T00:00:00Z",
    }),
    note({ id: "fijada", title: "Importante", pinned: true, updated_at: "2025-01-01T00:00:00Z" }),
    note({ id: "borrada1", title: "Basura", deleted_at: "2026-02-01T00:00:00Z" }),
    note({ id: "borrada2", title: "Otra", deleted_at: "2026-02-05T00:00:00Z" }),
  ];

  it("vista notas: sin papelera, fijadas primero, luego mas recientes", () => {
    expect(selectVisibleNotes(notes, "notes", "").map((n) => n.id)).toEqual(["fijada", "nueva", "vieja"]);
  });

  it("vista papelera: solo borradas, la ultima borrada primero", () => {
    expect(selectVisibleNotes(notes, "trash", "").map((n) => n.id)).toEqual(["borrada2", "borrada1"]);
  });

  it("busca en titulo y contenido, sin importar tildes ni mayusculas", () => {
    expect(selectVisibleNotes(notes, "notes", "cordoba").map((n) => n.id)).toEqual(["nueva"]);
    expect(selectVisibleNotes(notes, "notes", "COMPRAS").map((n) => n.id)).toEqual(["vieja"]);
    expect(selectVisibleNotes(notes, "notes", "seguridad").map((n) => n.id)).toEqual(["nueva"]); // keywords
    expect(selectVisibleNotes(notes, "notes", "strong")).toEqual([]); // no busca nombres de etiquetas HTML
    expect(selectVisibleNotes(notes, "notes", "basura")).toEqual([]); // esta en la papelera
  });

  it("cuenta las de la papelera", () => {
    expect(countTrash(notes)).toBe(2);
  });
});
