// ============================================================
//  TIPOS COMPARTIDOS
// ------------------------------------------------------------
//  Aca vive la "forma" de los datos de toda la app.
//  Definir el tipo una sola vez = documentacion + autocompletado
//  + el editor te avisa si te equivocas de campo.
// ============================================================

// Tipo de nota. Segun el tipo, `content` se interpreta distinto:
//   - "nota"   -> HTML enriquecido (ver Editor).
//   - "gastos" -> JSON con listas de gastos (ver GastosData).
//   - "peso"   -> JSON con registros de peso diarios (ver PesoData).
// El tipo se elige al crearla y no cambia despues.
export type NoteKind = "nota" | "gastos" | "peso";

// Una nota tal como existe en la base de datos.
export type Note = {
  id: string;
  user_id: string;
  kind: NoteKind; // "nota" (HTML) o "gastos" (JSON de listas de gastos)
  title: string;
  content: string;
  pinned: boolean; // si esta fijada, va siempre arriba de la lista
  keywords: string; // bloc de aclaraciones/definiciones, atado a la nota
  deleted_at: string | null; // null = normal; con fecha = en la papelera
  created_at: string; // fecha en formato ISO (texto)
  // "Version" de la nota: la base la cambia SOLO cuando cambia el titulo,
  // el contenido o las keywords (ver trigger en supabase/schema.sql). El
  // autoguardado la usa para detectar si otro dispositivo edito en el medio.
  updated_at: string;
};

// Lo que escribe el usuario y guarda el autoguardado (utils/autosaveQueue.ts).
// "Partial" significa "todos opcionales": podes guardar solo el titulo,
// solo el contenido, las keywords, o varios a la vez.
// `kind` no esta aca a proposito: se fija al crear la nota y no se edita.
// Fijar y la papelera tienen sus propias operaciones (useNotes).
export type NoteUpdate = Partial<Pick<Note, "title" | "content" | "keywords">>;

// Un cambio que llega en vivo desde Supabase Realtime (otro dispositivo,
// otra pestana, o el "eco" de nuestro propio guardado).
export type RemoteNoteChange =
  | { type: "upsert"; note: Note } // INSERT o UPDATE
  | { type: "delete"; id: string }; // DELETE (borrado definitivo)

// ----- Notas de gastos -----------------------------------------
// Una nota de gastos contiene varias "listas" (p. ej. "Servicios",
// "Tarjetas"); cada lista tiene renglones con un check de pagado, el
// concepto y el monto. Esto se serializa a JSON y se guarda en `content`.

// Todos los campos nuevos son OPCIONALES: las notas viejas (sin ellos) se
// leen igual. Ver la logica en lib/gastos.ts.

export type GastoRenglon = {
  id: string;
  pagado: boolean; // tildado cuando ya lo pagaste (o cobraste, si es ingreso)
  concepto: string; // descripcion del gasto
  // Importe (0 si esta vacio). En un "ingreso" se guarda positivo. En notas
  // viejas un gasto con monto negativo se cuenta como ingreso (compatibilidad).
  monto: number;
  tipo?: "gasto" | "ingreso"; // sin tipo = gasto
  cuota?: { actual: number; total: number }; // p. ej. 5/12; avanza al cerrar el mes
  soloEsteMes?: boolean; // se borra al cerrar el mes (gasto de una sola vez)
  moneda?: "USD"; // sin moneda = moneda local; USD se convierte con la cotizacion
};

export type GastoLista = {
  id: string;
  titulo: string;
  renglones: GastoRenglon[];
  vence?: number; // dia del mes en que vence el pago (1-31), p. ej. tarjetas
};

// Resumen de un mes cerrado, guardado en el historial de la nota.
export type ResumenMes = {
  mes: string; // 'YYYY-MM'
  ingresos: number; // en moneda local, positivo
  gastos: number; // en moneda local, positivo
  saldo: number; // ingresos - gastos
  pendiente: number; // gastos que quedaron sin pagar al cerrar
  listas: { titulo: string; ingresos: number; gastos: number }[];
  cerradoEl: string; // fecha ISO del cierre
};

export type GastosData = {
  listas: GastoLista[];
  mes?: string; // 'YYYY-MM': mes que representa la nota hoy
  cotizacionUSD?: number; // cuantos pesos vale 1 USD este mes
  historial?: ResumenMes[]; // meses cerrados, del mas viejo al mas nuevo
  ocultarConversion?: boolean; // el usuario descarto el aviso de "convertir formato viejo"
};

// ----- Notas de peso -------------------------------------------
// Una nota de peso es un registro diario: cada manana anotas tu peso. Cada
// renglon lleva su PROPIA fecha (no la de la nota), asi se puede cargar un dia
// olvidado o corregir cualquier fecha a mano. Se serializa a JSON en `content`.

export type PesoRegistro = {
  id: string;
  fecha: string; // dia del pesaje en formato 'YYYY-MM-DD' (sin hora)
  peso: number; // en kg
};

export type PesoData = {
  registros: PesoRegistro[];
};
