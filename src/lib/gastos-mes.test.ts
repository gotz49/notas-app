// Tests de la gestion mensual de las notas de gastos: ingresos vs gastos,
// cuotas, USD, cierre de mes, historial y vencimientos. Es logica que toca
// plata y datos guardados: si falla, se pierden renglones o se suman mal.
import { describe, expect, it } from "vitest";
import type { GastosData, GastoRenglon } from "../types";
import {
  cerrarMes,
  compararConAnterior,
  convertibles,
  convertirFormatoViejo,
  detectarCuota,
  esMesValido,
  formatDiferencia,
  nombreMes,
  parseGastos,
  resumen,
  serializeGastos,
  subtotalLista,
  textoBuscableGastos,
  sumarMeses,
  totalGeneral,
  totalesLista,
  vencimientos,
} from "./gastos";

function r(campos: Partial<GastoRenglon> & { monto: number }): GastoRenglon {
  return { id: Math.random().toString(36), pagado: false, concepto: "x", ...campos };
}

describe("meses", () => {
  it("suma meses cruzando el año", () => {
    expect(sumarMeses("2026-11", 1)).toBe("2026-12");
    expect(sumarMeses("2026-12", 1)).toBe("2027-01");
    expect(sumarMeses("2026-01", -1)).toBe("2025-12");
  });
  it("valida y nombra meses", () => {
    expect(esMesValido("2026-11")).toBe(true);
    expect(esMesValido("2026-13")).toBe(false);
    expect(esMesValido(undefined)).toBe(false);
    expect(nombreMes("2026-11")).toBe("Noviembre 2026");
    expect(nombreMes("2026-11", true)).toBe("nov 26");
  });
});

describe("ingresos, gastos y USD", () => {
  it("los negativos viejos cuentan como ingreso y los totales no cambian", () => {
    const lista = {
      id: "l",
      titulo: "Sueldo",
      renglones: [r({ monto: -17055 }), r({ monto: 800 })],
    };
    expect(subtotalLista(lista)).toBe(-16255);
    const t = totalesLista(lista);
    expect(t.ingresos).toBe(17055);
    expect(t.gastos).toBe(800);
  });

  it("un ingreso siempre resta, aunque se cargue positivo", () => {
    const lista = { id: "l", titulo: "A", renglones: [r({ monto: 100, tipo: "ingreso" })] };
    expect(subtotalLista(lista)).toBe(-100);
  });

  it("USD se convierte con la cotizacion; sin cotizacion avisa", () => {
    const data: GastosData = {
      listas: [{ id: "l", titulo: "A", renglones: [r({ monto: 20, moneda: "USD" }), r({ monto: 100 })] }],
    };
    expect(resumen(data).faltaCotizacion).toBe(true);
    expect(totalGeneral(data)).toBe(100);
    data.cotizacionUSD = 40;
    expect(resumen(data).faltaCotizacion).toBe(false);
    expect(totalGeneral(data)).toBe(900);
  });

  it("resumen: saldo y pendiente", () => {
    const data: GastosData = {
      listas: [
        { id: "a", titulo: "A", renglones: [r({ monto: 2700, pagado: true }), r({ monto: 2000 })] },
        { id: "b", titulo: "B", renglones: [r({ monto: 5000, tipo: "ingreso" })] },
      ],
    };
    expect(resumen(data)).toMatchObject({ ingresos: 5000, gastos: 4700, saldo: 300, pendiente: 2000 });
  });

  it("formatDiferencia pone signo", () => {
    expect(formatDiferencia(1200)).toBe("+1.200,00");
    expect(formatDiferencia(-300)).toBe("-300,00");
    expect(formatDiferencia(0)).toBe("0,00");
  });
});

describe("cuotas en el texto", () => {
  it("detecta la cuota al final del concepto", () => {
    expect(detectarCuota("Pixel 5/12")).toEqual({ concepto: "Pixel", cuota: { actual: 5, total: 12 } });
    expect(detectarCuota("A7 - Nhicol 4/6")).toEqual({ concepto: "A7 - Nhicol", cuota: { actual: 4, total: 6 } });
    expect(detectarCuota("Sofá 5 / 12")).toEqual({ concepto: "Sofá", cuota: { actual: 5, total: 12 } });
  });
  it("no confunde otras cosas con cuotas", () => {
    expect(detectarCuota("Claude Pro (20 usd)")).toBeNull();
    expect(detectarCuota("Sueldo __ 26400")).toBeNull();
    expect(detectarCuota("Pago 7/3")).toBeNull(); // actual > total
    expect(detectarCuota("Algo 1/1")).toBeNull(); // una sola cuota
    expect(detectarCuota("3/6")).toBeNull(); // sin concepto
  });
  it("no toma fechas como cuotas", () => {
    expect(detectarCuota("Luz 05/11")).toBeNull(); // cero adelante
    expect(detectarCuota("Luz vto 5/11")).toBeNull();
    expect(detectarCuota("Turno el 3/12")).toBeNull();
  });
  it("convierte cuotas y negativos sin cambiar los totales", () => {
    const data: GastosData = {
      listas: [
        {
          id: "l",
          titulo: "A",
          renglones: [
            r({ concepto: "Pixel 5/12", monto: 2315 }),
            r({ concepto: "sueldo", monto: -17055 }),
            r({ concepto: "Luz", monto: 2800 }),
          ],
        },
      ],
    };
    expect(convertibles(data)).toMatchObject({
      cuotas: 1,
      negativos: 1,
      conceptosCuotas: ["Pixel 5/12"],
      conceptosNegativos: ["sueldo"],
    });
    const conv = convertirFormatoViejo(data);
    expect(totalGeneral(conv)).toBe(totalGeneral(data));
    expect(conv.listas[0].renglones[0]).toMatchObject({ concepto: "Pixel", cuota: { actual: 5, total: 12 } });
    expect(conv.listas[0].renglones[1]).toMatchObject({ tipo: "ingreso", monto: 17055 });
    expect(convertibles(conv)).toMatchObject({ cuotas: 0, negativos: 0 });
  });
});

describe("cerrar mes", () => {
  const ahora = new Date(2026, 10, 30, 12); // 30 nov 2026
  const base: GastosData = {
    mes: "2026-11",
    listas: [
      {
        id: "oca",
        titulo: "OCA",
        renglones: [
          r({ concepto: "Pixel", monto: 2315, pagado: true, cuota: { actual: 5, total: 12 } }),
          r({ concepto: "Magnesio", monto: 500, pagado: true, cuota: { actual: 6, total: 6 } }),
          r({ concepto: "Remeras", monto: 400, pagado: true, soloEsteMes: true }),
          r({ concepto: "YT", monto: 850, pagado: true }),
        ],
      },
      {
        id: "auto",
        titulo: "Auto",
        renglones: [r({ concepto: "Nafta", monto: 2000 })],
      },
      {
        id: "sueldo",
        titulo: "Sueldo",
        renglones: [r({ concepto: "sueldo", monto: 20000, tipo: "ingreso", pagado: true })],
      },
    ],
  };

  it("guarda el resumen, avanza cuotas, saca terminadas y destilda", () => {
    const { data, cambios } = cerrarMes(base, ahora);
    expect(data.mes).toBe("2026-12");
    expect(cambios.terminadas).toEqual(["Magnesio"]);
    expect(cambios.soloEsteMes).toEqual(["Remeras"]);
    expect(cambios.avanzadas).toBe(1);
    expect(cambios.sinPagar).toEqual([{ concepto: "Nafta", monto: 2000 }]);

    const oca = data.listas[0].renglones;
    expect(oca.map((x) => x.concepto)).toEqual(["Pixel", "YT"]);
    expect(oca[0].cuota).toEqual({ actual: 6, total: 12 });
    expect(data.listas.flatMap((l) => l.renglones).every((x) => !x.pagado)).toBe(true);

    expect(data.historial).toHaveLength(1);
    expect(data.historial![0]).toMatchObject({
      mes: "2026-11",
      ingresos: 20000,
      gastos: 6065,
      saldo: 13935,
      pendiente: 2000,
    });
    expect(data.historial![0].listas[0]).toEqual({ titulo: "OCA", ingresos: 0, gastos: 4065 });
  });

  it("avisa lo que se borra sin pagar y la falta de cotizacion", () => {
    const data: GastosData = {
      mes: "2026-11",
      listas: [
        {
          id: "a",
          titulo: "A",
          renglones: [
            r({ concepto: "Ultima", monto: 100, cuota: { actual: 3, total: 3 } }),
            r({ concepto: "Netflix", monto: 10, moneda: "USD" }),
          ],
        },
      ],
    };
    const { cambios } = cerrarMes(data, ahora);
    expect(cambios.borradosSinPagar).toEqual([{ concepto: "Ultima", monto: 100 }]);
    expect(cambios.sinPagar).toEqual([]);
    expect(cambios.faltaCotizacion).toBe(true);
  });

  it("no modifica la nota original", () => {
    const copia = JSON.parse(serializeGastos(base));
    cerrarMes(base, ahora);
    expect(base).toEqual(copia);
  });

  it("cerrar dos veces el mismo mes reemplaza el cierre, no lo duplica", () => {
    const primero = cerrarMes(base, ahora).data;
    const otraVez = { ...primero, mes: "2026-11" };
    const { data, cambios } = cerrarMes(otraVez, ahora);
    expect(cambios.reemplazaHistorial).toBe(true);
    expect(data.historial!.filter((h) => h.mes === "2026-11")).toHaveLength(1);
  });

  it("sin mes usa el mes de la fecha de cierre", () => {
    const { cambios } = cerrarMes({ listas: [] }, ahora);
    expect(cambios.mes).toBe("2026-11");
    expect(cambios.mesSiguiente).toBe("2026-12");
  });

  it("el historial queda ordenado y se compara con el mes anterior", () => {
    const { data } = cerrarMes(base, ahora);
    // En diciembre, OCA tiene Pixel 2315 + YT 850 = 3165 vs 4065 en noviembre.
    const comp = compararConAnterior(data, data.listas[0]);
    expect(comp).toEqual({ mes: "2026-11", diferencia: -900 });
    // Una lista nueva (sin titulo igual en el historial) no compara.
    expect(compararConAnterior(data, { id: "z", titulo: "Nueva", renglones: [] })).toBeNull();
  });

  it("sobrevive al JSON (guardar y leer)", () => {
    const { data } = cerrarMes(base, ahora);
    expect(parseGastos(serializeGastos(data))).toEqual(data);
  });
});

describe("parse robusto", () => {
  it("repara renglones e historial rotos", () => {
    const data = parseGastos(JSON.stringify({ listas: [{ id: "a", titulo: "A" }], historial: "x" }));
    expect(data.listas[0].renglones).toEqual([]);
    expect(data.historial).toBeUndefined();
  });
  it("repara renglones con tipos rotos (concepto null, monto en texto)", () => {
    const json = JSON.stringify({ listas: [{ id: "a", titulo: "A", renglones: [{ id: "1", concepto: null, monto: "50" }] }] });
    const data = parseGastos(json);
    expect(data.listas[0].renglones[0]).toMatchObject({ concepto: "", monto: 50, pagado: false });
    expect(() => cerrarMes(data)).not.toThrow();
  });
  it("el buscador ve titulos y conceptos, no las claves del JSON", () => {
    const json = serializeGastos({ mes: "2026-11", listas: [{ id: "a", titulo: "OCA", renglones: [r({ concepto: "Pixel", monto: 1 })] }] });
    const texto = textoBuscableGastos(json);
    expect(texto).toContain("OCA");
    expect(texto).toContain("Pixel");
    expect(texto).not.toContain("monto");
    expect(texto).not.toContain("2026");
  });
});

describe("vencimientos", () => {
  const hoy = new Date(2026, 10, 8); // 8 nov 2026
  it("ordena por urgencia y omite listas pagadas o sin vencimiento", () => {
    const data: GastosData = {
      mes: "2026-11",
      listas: [
        { id: "a", titulo: "OCA", vence: 15, renglones: [r({ monto: 100 })] },
        { id: "b", titulo: "Scotia", vence: 5, renglones: [r({ monto: 50 })] },
        { id: "c", titulo: "Pagada", vence: 10, renglones: [r({ monto: 50, pagado: true })] },
        { id: "d", titulo: "Sin vence", renglones: [r({ monto: 50 })] },
      ],
    };
    const v = vencimientos(data, hoy);
    expect(v.map((x) => [x.titulo, x.dias])).toEqual([["Scotia", -3], ["OCA", 7]]);
  });
  it("ajusta el 31 a meses cortos y no avisa si la nota es de otro mes", () => {
    const feb = new Date(2027, 1, 10);
    const data: GastosData = { mes: "2027-02", listas: [{ id: "a", titulo: "A", vence: 31, renglones: [r({ monto: 1 })] }] };
    expect(vencimientos(data, feb)[0].dia).toBe(28);
    expect(vencimientos({ ...data, mes: "2027-03" }, feb)).toEqual([]);
  });
});
