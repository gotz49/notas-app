// ============================================================
//  Helpers de notas de peso  (logica pura, sin React ni Supabase)
// ------------------------------------------------------------
//  Una nota de peso guarda en `note.content` un JSON con la forma
//  PesoData: una lista de registros { fecha, peso }. Aca vive todo lo
//  que necesita esa estructura: parsear/serializar el JSON, crear
//  registros, ordenarlos, filtrarlos por rango de fechas y formatear.
//  Compartido por el editor y el export para que usen la misma logica.
// ============================================================
import type { PesoData, PesoRegistro } from "../types";

function nuevoId(): string {
  return crypto.randomUUID();
}

// Fecha de hoy en formato 'YYYY-MM-DD' segun la hora LOCAL (no UTC), para que
// "hoy" sea el dia del usuario y no se corra por zona horaria.
export function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 10);
}

export function nuevoRegistro(peso = 0, fecha = hoyISO()): PesoRegistro {
  return { id: nuevoId(), fecha, peso };
}

// Una nota de peso recien creada arranca vacia (sin registros): el usuario
// carga el primero desde el form.
export function pesoInicial(): PesoData {
  return { registros: [] };
}

// Lee el `content` (texto) y devuelve siempre un PesoData valido. Si el JSON
// esta vacio o roto, cae a la estructura inicial en vez de explotar.
export function parsePeso(content: string): PesoData {
  try {
    const data = JSON.parse(content);
    if (data && Array.isArray(data.registros)) return data as PesoData;
  } catch {
    // contenido vacio o no-JSON: usamos el inicial
  }
  return pesoInicial();
}

export function serializePeso(data: PesoData): string {
  return JSON.stringify(data);
}

// Ordena por fecha. Por defecto descendente (mas reciente primero) para el
// listado; el grafico pide ascendente para dibujar la linea en orden temporal.
export function ordenarPorFecha(
  registros: PesoRegistro[],
  asc = false
): PesoRegistro[] {
  const copia = [...registros];
  copia.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return asc ? copia : copia.reverse();
}

// Filtra los registros dentro de [desde, hasta] inclusive. Como las fechas son
// 'YYYY-MM-DD', comparar como texto equivale a comparar cronologicamente.
export function registrosEnRango(
  registros: PesoRegistro[],
  desde: string,
  hasta: string
): PesoRegistro[] {
  return registros.filter((r) => r.fecha >= desde && r.fecha <= hasta);
}

// Formatea un peso con 2 decimales (es-AR: 85,42). Sin unidad (la pone el UI).
// Se registra con 2 decimales, asi que el grafico exportado tambien los muestra.
const formatter = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export function formatPeso(n: number): string {
  return formatter.format(n || 0);
}

// Formatea una fecha 'YYYY-MM-DD' como "12 jun" (es), sin desfase de zona: la
// interpretamos como fecha local construyendola con sus partes.
export function formatFecha(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return iso;
  return new Date(a, m - 1, d).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
}
