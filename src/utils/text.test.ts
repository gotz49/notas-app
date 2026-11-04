import { describe, expect, it } from "vitest";
import { normalize, toPlainText } from "./text";
import { toUserMessage } from "./errors";

describe("normalize", () => {
  it("quita tildes y pasa a minusculas", () => {
    expect(normalize("Título ÑANDÚ")).toBe("titulo nandu");
  });
});

describe("toPlainText", () => {
  it("saca etiquetas HTML", () => {
    const html = '<h1>Hola</h1><ul><li><p><strong>uno</strong> <span data-type="date" data-value="2026-01-01">1 ene</span></p></li></ul>';
    expect(toPlainText(html)).toBe("Hola uno 1 ene");
  });
});

describe("toUserMessage", () => {
  it("traduce errores conocidos de Supabase", () => {
    expect(toUserMessage(new Error("Invalid login credentials"))).toBe("Email o contraseña incorrectos.");
    expect(toUserMessage({ message: "Failed to fetch" })).toMatch(/Sin conexión/);
  });
  it("usa el mensaje por defecto si no lo reconoce", () => {
    expect(toUserMessage(new Error("algo raro"), "Falló")).toBe("Falló");
    expect(toUserMessage(undefined)).toBe("Ocurrió un error inesperado.");
  });
});
