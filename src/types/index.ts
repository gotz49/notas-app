// ============================================================
//  TIPOS COMPARTIDOS
// ------------------------------------------------------------
//  Aca vive la "forma" de los datos de toda la app.
//  Definir el tipo una sola vez = documentacion + autocompletado
//  + el editor te avisa si te equivocas de campo.
// ============================================================

// Tipo de nota. Una nota normal ("nota") guarda HTML enriquecido en `content`;
// una nota de gastos ("gastos") guarda en `content` un JSON con listas de
// gastos (ver GastosData). El tipo se elige al crearla y no cambia despues.
export type NoteKind = "nota" | "gastos";

// Una nota tal como existe en la base de datos.
export type Note = {
  id: string;
  user_id: string;
  kind: NoteKind; // "nota" (HTML) o "gastos" (JSON de listas de gastos)
  title: string;
  content: string;
  pinned: boolean; // si esta fijada, va siempre arriba de la lista
  keywords: string; // bloc de aclaraciones/definiciones, atado a la nota
  created_at: string; // fecha en formato ISO (texto)
  updated_at: string;
};

// Los campos que el usuario puede editar de una nota.
// "Partial" significa "todos opcionales": podes actualizar solo el titulo,
// solo el contenido, las keywords, fijarla/desfijarla, o varios a la vez.
// `kind` no esta aca a proposito: se fija al crear la nota y no se edita.
export type NoteUpdate = Partial<
  Pick<Note, "title" | "content" | "pinned" | "keywords">
>;

// ----- Notas de gastos -----------------------------------------
// Una nota de gastos contiene varias "listas" (p. ej. "Servicios",
// "Tarjetas"); cada lista tiene renglones con un check de pagado, el
// concepto y el monto. Esto se serializa a JSON y se guarda en `content`.

export type GastoRenglon = {
  id: string;
  pagado: boolean; // tildado cuando ya lo pagaste
  concepto: string; // descripcion del gasto
  monto: number; // importe (0 si esta vacio)
};

export type GastoLista = {
  id: string;
  titulo: string;
  renglones: GastoRenglon[];
};

export type GastosData = {
  listas: GastoLista[];
};
