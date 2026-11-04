// Tests de las notas de gastos y de peso: su contenido es JSON, y si se
// lee mal se pierden datos. Estas funciones nunca deben "explotar".
import { describe, expect, it } from "vitest";
import { formatMonto, parseGastos, serializeGastos, subtotalLista, totalGeneral } from "./gastos";
import { ordenarPorFecha, parsePeso, registrosEnRango, serializePeso } from "./peso";

describe("gastos", () => {
  it("JSON vacio o roto -> estructura inicial (no explota)", () => {
    expect(parseGastos("").listas).toHaveLength(1);
    expect(parseGastos("{basura").listas).toHaveLength(1);
  });

  it("guardar y leer da lo mismo", () => {
    const data = {
      listas: [{ id: "l1", titulo: "Servicios", renglones: [{ id: "r1", pagado: true, concepto: "Luz", monto: 1500.5 }] }],
    };
    expect(parseGastos(serializeGastos(data))).toEqual(data);
  });

  it("subtotales y total general", () => {
    const data = {
      listas: [
        { id: "a", titulo: "A", renglones: [{ id: "1", pagado: false, concepto: "x", monto: 100 }, { id: "2", pagado: false, concepto: "y", monto: 50.25 }] },
        { id: "b", titulo: "B", renglones: [{ id: "3", pagado: true, concepto: "z", monto: 10 }] },
      ],
    };
    expect(subtotalLista(data.listas[0])).toBe(150.25);
    expect(totalGeneral(data)).toBe(160.25);
    expect(formatMonto(12345.678)).toBe("12.345,68");
  });
});

describe("peso", () => {
  const registros = [
    { id: "1", fecha: "2026-11-02", peso: 80 },
    { id: "2", fecha: "2026-11-04", peso: 79.5 },
    { id: "3", fecha: "2026-11-01", peso: 80.4 },
  ];

  it("JSON vacio o roto -> sin registros (no explota)", () => {
    expect(parsePeso("").registros).toEqual([]);
    expect(parsePeso("no es json").registros).toEqual([]);
  });

  it("guardar y leer da lo mismo", () => {
    expect(parsePeso(serializePeso({ registros }))).toEqual({ registros });
  });

  it("ordena por fecha y filtra por rango", () => {
    expect(ordenarPorFecha(registros).map((r) => r.id)).toEqual(["2", "1", "3"]);
    expect(ordenarPorFecha(registros, true).map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(registrosEnRango(registros, "2026-11-02", "2026-11-04").map((r) => r.id)).toEqual(["1", "2"]);
  });
});
