// ============================================================
//  Helpers de notas de gastos  (logica pura, sin React ni Supabase)
// ------------------------------------------------------------
//  Una nota de gastos guarda en `note.content` un JSON con la forma
//  GastosData. Aca vive todo lo que necesita esa estructura: parsear
//  y serializar el JSON, crear listas/renglones nuevos, sumar
//  subtotales/total y formatear montos. Mantenerlo separado del UI
//  hace que el editor y el export compartan exactamente la misma logica.
//
//  Ademas vive aca la gestion mensual:
//   - ingresos vs gastos (tipo del renglon), con compatibilidad para
//     notas viejas donde el ingreso se cargaba como monto negativo;
//   - cuotas (5/12) que avanzan solas al cerrar el mes;
//   - montos en USD convertidos con la cotizacion del mes;
//   - "Cerrar mes": guarda un resumen en el historial y prepara el
//     mes siguiente (destilda, avanza cuotas, saca lo de una sola vez).
// ============================================================
import type { GastosData, GastoLista, GastoRenglon, ResumenMes } from "../types";

// Crea un id unico para listas y renglones (no van a la base por separado,
// pero React necesita keys estables y nos sirve para editar/borrar).
function nuevoId(): string {
  return crypto.randomUUID();
}

export function nuevoRenglon(): GastoRenglon {
  return { id: nuevoId(), pagado: false, concepto: "", monto: 0 };
}

export function nuevaLista(titulo = "Gastos"): GastoLista {
  return { id: nuevoId(), titulo, renglones: [nuevoRenglon()] };
}

// Contenido inicial de una nota de gastos recien creada: una lista con un
// renglon vacio, listo para empezar a tipear, ya ubicada en el mes actual.
export function gastosInicial(): GastosData {
  return { listas: [nuevaLista()], mes: mesActual() };
}

// Lee el `content` (texto) y devuelve siempre un GastosData valido. Si el
// JSON esta vacio o roto, cae a una estructura inicial en vez de explotar.
// Tambien repara partes sueltas rotas (renglones o historial que no son
// listas) para que el editor nunca reciba algo que no puede mostrar.
export function parseGastos(content: string): GastosData {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.listas)) {
      const limpio: GastosData = {
        ...data,
        listas: data.listas
          .filter((l: unknown) => l && typeof l === "object")
          .map((l: GastoLista) => ({
            ...l,
            titulo: typeof l.titulo === "string" ? l.titulo : "",
            renglones: Array.isArray(l.renglones)
              ? l.renglones.filter((r) => r && typeof r === "object").map(normalizarRenglon)
              : [],
          })),
      };
      if (data.historial !== undefined && !Array.isArray(data.historial)) {
        delete limpio.historial;
      }
      return limpio;
    }
  } catch {
    // contenido vacio o no-JSON: usamos el inicial
  }
  return gastosInicial();
}

// Asegura los tipos basicos de un renglon (JSON viejo o editado a mano): sin
// esto, un concepto null o un monto en texto rompen las cuentas o el editor.
function normalizarRenglon(r: GastoRenglon): GastoRenglon {
  if (
    typeof r.concepto === "string" &&
    typeof r.monto === "number" &&
    Number.isFinite(r.monto) &&
    typeof r.pagado === "boolean"
  ) {
    return r;
  }
  return {
    ...r,
    concepto: typeof r.concepto === "string" ? r.concepto : String(r.concepto ?? ""),
    monto: Number.isFinite(Number(r.monto)) ? Number(r.monto) : 0,
    pagado: r.pagado === true,
  };
}

export function serializeGastos(data: GastosData): string {
  return JSON.stringify(data);
}

// ------------------------------------------------------------
//  Meses ('YYYY-MM')
// ------------------------------------------------------------

// Mes de una fecha segun la hora LOCAL (no UTC), en formato 'YYYY-MM'.
export function mesActual(fecha: Date = new Date()): string {
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${fecha.getFullYear()}-${m}`;
}

// true si el texto tiene forma 'YYYY-MM' con un mes valido.
export function esMesValido(mes: unknown): mes is string {
  if (typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes)) return false;
  const m = Number(mes.slice(5));
  return m >= 1 && m <= 12;
}

// Suma (o resta, con n negativo) meses a un 'YYYY-MM'.
export function sumarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  return mesActual(new Date(a, m - 1 + n, 1));
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

// 'YYYY-MM' -> "Noviembre 2026" (o "nov 26" en version corta).
export function nombreMes(mes: string, corto = false): string {
  if (!esMesValido(mes)) return mes;
  const [a, m] = mes.split("-").map(Number);
  const nombre = MESES[m - 1];
  if (corto) return `${nombre.slice(0, 3)} ${String(a).slice(2)}`;
  return `${nombre[0].toUpperCase()}${nombre.slice(1)} ${a}`;
}

// ------------------------------------------------------------
//  Montos: moneda, ingreso/gasto y totales
// ------------------------------------------------------------

// Monto del renglon en moneda local. Los renglones en USD se multiplican por
// la cotizacion; si no hay cotizacion cargada valen 0 (y el resumen avisa).
export function montoLocal(r: GastoRenglon, cotizacionUSD = 0): number {
  const monto = Number(r.monto) || 0;
  if (r.moneda === "USD") return monto * (cotizacionUSD > 0 ? cotizacionUSD : 0);
  return monto;
}

// Valor del renglon con signo: positivo = gasto, negativo = ingreso.
// Un ingreso siempre resta (aunque el monto se haya cargado negativo). Un
// renglon sin tipo con monto negativo (notas viejas) tambien resta: asi los
// totales de las notas existentes no cambian.
export function neto(r: GastoRenglon, cotizacionUSD = 0): number {
  const v = montoLocal(r, cotizacionUSD);
  return r.tipo === "ingreso" ? -Math.abs(v) : v;
}

// true si el renglon cuenta como ingreso (explicito o por monto negativo).
export function esIngreso(r: GastoRenglon): boolean {
  return r.tipo === "ingreso" || (Number(r.monto) || 0) < 0;
}

// Subtotal de una lista (suma con signo: gastos - ingresos).
export function subtotalLista(lista: GastoLista, cotizacionUSD = 0): number {
  return lista.renglones.reduce((acc, r) => acc + neto(r, cotizacionUSD), 0);
}

// Total general de toda la nota (gastos - ingresos de todas las listas).
export function totalGeneral(data: GastosData): number {
  return data.listas.reduce(
    (acc, l) => acc + subtotalLista(l, data.cotizacionUSD),
    0
  );
}

export type TotalesLista = {
  ingresos: number; // positivo
  gastos: number; // positivo
  pendiente: number; // gastos todavia sin tildar
  neto: number; // gastos - ingresos
};

export function totalesLista(lista: GastoLista, cotizacionUSD = 0): TotalesLista {
  const t: TotalesLista = { ingresos: 0, gastos: 0, pendiente: 0, neto: 0 };
  for (const r of lista.renglones) {
    const v = neto(r, cotizacionUSD);
    if (v < 0) t.ingresos += -v;
    else {
      t.gastos += v;
      if (!r.pagado) t.pendiente += v;
    }
    t.neto += v;
  }
  return t;
}

export type Resumen = {
  ingresos: number;
  gastos: number;
  saldo: number; // ingresos - gastos (positivo = sobra plata)
  pendiente: number; // gastos sin pagar
  faltaCotizacion: boolean; // hay renglones en USD pero no hay cotizacion
};

export function resumen(data: GastosData): Resumen {
  const cot = data.cotizacionUSD ?? 0;
  let ingresos = 0;
  let gastos = 0;
  let pendiente = 0;
  for (const l of data.listas) {
    const t = totalesLista(l, cot);
    ingresos += t.ingresos;
    gastos += t.gastos;
    pendiente += t.pendiente;
  }
  return {
    ingresos,
    gastos,
    saldo: ingresos - gastos,
    pendiente,
    faltaCotizacion: !(cot > 0) && tieneUSD(data),
  };
}

export function tieneUSD(data: GastosData): boolean {
  return data.listas.some((l) => l.renglones.some((r) => r.moneda === "USD"));
}

// Formatea un monto con separadores de miles y 2 decimales (formato es-AR:
// 12.345,67). Sin simbolo de moneda, para no asumir una en particular.
const formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatMonto(n: number): string {
  return formatter.format(n || 0);
}

// Igual que formatMonto pero con signo explicito (+1.200,00 / -300,00), para
// mostrar diferencias contra el mes anterior.
export function formatDiferencia(n: number): string {
  const s = formatMonto(Math.abs(n));
  if (Math.abs(n) < 0.005) return s;
  return n > 0 ? `+${s}` : `-${s}`;
}

// ------------------------------------------------------------
//  Cuotas escritas en el texto -> campo propio (migracion)
// ------------------------------------------------------------

// "Pixel 5/12" -> { concepto: "Pixel", cuota: {5, 12} }. Solo reconoce la
// cuota al FINAL del concepto, con actual entre 1 y total (total >= 2).
// Descarta lo que parece una fecha: numeros con cero adelante ("05/11") o
// precedidos de "vto", "vence", "fecha", "el", "dia". Igual puede haber falsos
// positivos ("Gas 10/12"): por eso el editor muestra que va a convertir antes
// de hacerlo. Devuelve null si no hay cuota.
export function detectarCuota(
  concepto: string
): { concepto: string; cuota: { actual: number; total: number } } | null {
  const m = /^(.*?)[\s\-–—:]*\b(\d{1,3})\s*\/\s*(\d{1,3})\s*$/.exec(concepto);
  if (!m) return null;
  if (/^0\d/.test(m[2]) || /^0\d/.test(m[3])) return null; // "05/11": fecha
  const actual = Number(m[2]);
  const total = Number(m[3]);
  if (total < 2 || actual < 1 || actual > total) return null;
  const limpio = m[1].trim();
  if (!limpio) return null; // "3/6" a secas: no hay concepto que quede
  if (/(^|\s)(vto|vence|venc|vencimiento|fecha|el|d[ií]a)\.?$/i.test(limpio)) return null;
  return { concepto: limpio, cuota: { actual, total } };
}

// Cuantos renglones se pueden convertir al formato nuevo:
//  - cuotas escritas en el concepto (sin campo cuota todavia);
//  - montos negativos sin tipo (ingresos cargados "a la vieja").
// Ademas devuelve los conceptos, para mostrarlos antes de convertir.
export function convertibles(data: GastosData): {
  cuotas: number;
  negativos: number;
  conceptosCuotas: string[];
  conceptosNegativos: string[];
} {
  const conceptosCuotas: string[] = [];
  const conceptosNegativos: string[] = [];
  for (const l of data.listas) {
    for (const r of l.renglones) {
      if (!r.cuota && detectarCuota(r.concepto)) conceptosCuotas.push(r.concepto.trim());
      if (!r.tipo && (Number(r.monto) || 0) < 0) {
        conceptosNegativos.push(r.concepto.trim() || "(sin concepto)");
      }
    }
  }
  return {
    cuotas: conceptosCuotas.length,
    negativos: conceptosNegativos.length,
    conceptosCuotas,
    conceptosNegativos,
  };
}

// Aplica la conversion. Los totales NO cambian: un negativo sin tipo ya
// contaba como ingreso; ahora queda marcado como ingreso y en positivo.
export function convertirFormatoViejo(data: GastosData): GastosData {
  return {
    ...data,
    listas: data.listas.map((l) => ({
      ...l,
      renglones: l.renglones.map((r) => {
        let next = r;
        if (!r.cuota) {
          const d = detectarCuota(r.concepto);
          if (d) next = { ...next, concepto: d.concepto, cuota: d.cuota };
        }
        if (!r.tipo && (Number(r.monto) || 0) < 0) {
          next = { ...next, tipo: "ingreso", monto: Math.abs(Number(r.monto)) };
        }
        return next;
      }),
    })),
  };
}

// ------------------------------------------------------------
//  Cerrar mes e historial
// ------------------------------------------------------------

// Resumen del mes tal como esta la nota ahora (lo que se guarda al cerrar).
export function resumenMes(data: GastosData, mes: string, cerradoEl: string): ResumenMes {
  const r = resumen(data);
  const cot = data.cotizacionUSD ?? 0;
  return {
    mes,
    ingresos: redondear(r.ingresos),
    gastos: redondear(r.gastos),
    saldo: redondear(r.saldo),
    pendiente: redondear(r.pendiente),
    listas: data.listas.map((l) => {
      const t = totalesLista(l, cot);
      return {
        titulo: l.titulo,
        ingresos: redondear(t.ingresos),
        gastos: redondear(t.gastos),
      };
    }),
    cerradoEl,
  };
}

// Redondea a centavos (evita 0.30000000000000004 en el historial).
function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CambiosCierre = {
  mes: string; // mes que se cierra
  mesSiguiente: string; // mes en el que queda la nota
  resumen: ResumenMes;
  reemplazaHistorial: boolean; // ya habia un cierre de ese mes
  terminadas: string[]; // conceptos de cuotas que terminan (se sacan)
  soloEsteMes: string[]; // conceptos de una sola vez (se sacan)
  avanzadas: number; // cuotas que avanzan (5/12 -> 6/12)
  sinPagar: { concepto: string; monto: number }[]; // gastos sin tildar que siguen
  borradosSinPagar: { concepto: string; monto: number }[]; // sin tildar y se borran
  faltaCotizacion: boolean; // hay USD sin cotizacion: en el resumen cuentan 0
};

// Calcula el cierre del mes SIN aplicarlo: devuelve la nota como queda y la
// lista de cambios, para mostrarlos antes de confirmar.
//   - guarda el resumen del mes en el historial (si ya habia un cierre de
//     ese mes, lo reemplaza);
//   - saca los renglones "solo este mes" y las cuotas que terminaron;
//   - avanza las demas cuotas;
//   - destilda todo;
//   - pasa la nota al mes siguiente.
// `ahora` es la fecha del cierre (se pasa para que sea testeable).
export function cerrarMes(
  data: GastosData,
  ahora: Date = new Date()
): { data: GastosData; cambios: CambiosCierre } {
  const mes = esMesValido(data.mes) ? data.mes : mesActual(ahora);
  const res = resumenMes(data, mes, ahora.toISOString());
  const cot = data.cotizacionUSD ?? 0;

  const cambios: CambiosCierre = {
    mes,
    mesSiguiente: sumarMeses(mes, 1),
    resumen: res,
    reemplazaHistorial: (data.historial ?? []).some((h) => h.mes === mes),
    terminadas: [],
    soloEsteMes: [],
    avanzadas: 0,
    sinPagar: [],
    borradosSinPagar: [],
    faltaCotizacion: resumen(data).faltaCotizacion,
  };

  const listas = data.listas.map((l) => {
    const renglones: GastoRenglon[] = [];
    for (const r of l.renglones) {
      const nombre = r.concepto.trim() || "(sin concepto)";
      const v = neto(r, cot);
      const seBorra = !!r.soloEsteMes || (!!r.cuota && r.cuota.actual >= r.cuota.total);
      if (!r.pagado && v > 0) {
        (seBorra ? cambios.borradosSinPagar : cambios.sinPagar).push({ concepto: nombre, monto: v });
      }

      if (r.soloEsteMes) {
        cambios.soloEsteMes.push(nombre);
        continue;
      }
      if (r.cuota && r.cuota.actual >= r.cuota.total) {
        cambios.terminadas.push(nombre);
        continue;
      }
      let next: GastoRenglon = { ...r, pagado: false };
      if (r.cuota) {
        next = { ...next, cuota: { ...r.cuota, actual: r.cuota.actual + 1 } };
        cambios.avanzadas++;
      }
      renglones.push(next);
    }
    return { ...l, renglones };
  });

  const historial = [...(data.historial ?? []).filter((h) => h.mes !== mes), res].sort(
    (a, b) => a.mes.localeCompare(b.mes)
  );

  return {
    data: { ...data, listas, mes: cambios.mesSiguiente, historial },
    cambios,
  };
}

// Diferencia del neto (gastos - ingresos) de una lista contra el ultimo mes
// cerrado ANTERIOR al mes actual de la nota. Se busca la lista por titulo
// (sin mayusculas ni espacios de mas). null si no hay con que comparar.
export function compararConAnterior(
  data: GastosData,
  lista: GastoLista
): { mes: string; diferencia: number } | null {
  const anterior = ultimoCierreAnterior(data);
  if (!anterior) return null;
  const clave = normalizarTitulo(lista.titulo);
  if (!clave) return null;
  const previa = anterior.listas.find((l) => normalizarTitulo(l.titulo) === clave);
  if (!previa) return null;
  const actual = totalesLista(lista, data.cotizacionUSD ?? 0).neto;
  return { mes: anterior.mes, diferencia: actual - (previa.gastos - previa.ingresos) };
}

// El ultimo mes cerrado antes del mes actual de la nota (o el ultimo, si la
// nota no tiene mes).
export function ultimoCierreAnterior(data: GastosData): ResumenMes | null {
  const hist = data.historial ?? [];
  const candidatos = esMesValido(data.mes) ? hist.filter((h) => h.mes < data.mes!) : hist;
  if (candidatos.length === 0) return null;
  return candidatos.reduce((a, b) => (b.mes > a.mes ? b : a));
}

function normalizarTitulo(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

// ------------------------------------------------------------
//  Vencimientos
// ------------------------------------------------------------

export type Vencimiento = {
  listaId: string;
  titulo: string;
  dia: number; // dia del mes (ya ajustado a meses cortos)
  dias: number; // dias que faltan (negativo = ya vencio)
  pendiente: number;
};

// Listas con dia de vencimiento y algo sin pagar, de la mas urgente a la
// menos. `hoy` se pasa para poder testear. Si la nota esta en otro mes que
// `hoy`, no hay "dias que faltan" confiables y no se devuelve nada.
export function vencimientos(data: GastosData, hoy: Date = new Date()): Vencimiento[] {
  if (esMesValido(data.mes) && data.mes !== mesActual(hoy)) return [];
  const cot = data.cotizacionUSD ?? 0;
  const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const out: Vencimiento[] = [];
  for (const l of data.listas) {
    if (!l.vence || l.vence < 1) continue;
    const pendiente = totalesLista(l, cot).pendiente;
    if (pendiente <= 0) continue;
    const dia = Math.min(Math.floor(l.vence), diasDelMes);
    out.push({
      listaId: l.id,
      titulo: l.titulo,
      dia,
      dias: dia - hoy.getDate(),
      pendiente,
    });
  }
  return out.sort((a, b) => a.dias - b.dias);
}

// ------------------------------------------------------------
//  Busqueda
// ------------------------------------------------------------

// Texto de una nota de gastos para el buscador: titulos de listas y conceptos.
// Sin esto se buscaria sobre el JSON crudo y "ingresos", "mes" o "2026"
// encontrarian todas las notas de gastos.
export function textoBuscableGastos(content: string): string {
  const data = parseGastos(content);
  return data.listas
    .map((l) => [l.titulo, ...l.renglones.map((r) => r.concepto)].join(" "))
    .join(" ");
}
