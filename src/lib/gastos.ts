// ============================================================
//  Helpers de notas de gastos  (logica pura, sin React ni Supabase)
// ------------------------------------------------------------
//  Una nota de gastos guarda en `note.content` un JSON con la forma
//  GastosData. Aca vive todo lo que necesita esa estructura: parsear
//  y serializar el JSON, crear listas/renglones nuevos, sumar
//  subtotales/total y formatear montos. Mantenerlo separado del UI
//  hace que el editor y el export compartan exactamente la misma logica.
// ============================================================
import type { GastosData, GastoLista, GastoRenglon } from "../types";

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
// renglon vacio, listo para empezar a tipear.
export function gastosInicial(): GastosData {
  return { listas: [nuevaLista()] };
}

// Lee el `content` (texto) y devuelve siempre un GastosData valido. Si el
// JSON esta vacio o roto, cae a una estructura inicial en vez de explotar.
export function parseGastos(content: string): GastosData {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.listas)) return data as GastosData;
  } catch {
    // contenido vacio o no-JSON: usamos el inicial
  }
  return gastosInicial();
}

export function serializeGastos(data: GastosData): string {
  return JSON.stringify(data);
}

// Subtotal de una lista (suma de sus montos).
export function subtotalLista(lista: GastoLista): number {
  return lista.renglones.reduce((acc, r) => acc + (r.monto || 0), 0);
}

// Total general de toda la nota (suma de todas las listas).
export function totalGeneral(data: GastosData): number {
  return data.listas.reduce((acc, l) => acc + subtotalLista(l), 0);
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
