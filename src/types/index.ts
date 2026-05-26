// ============================================================
//  TIPOS COMPARTIDOS
// ------------------------------------------------------------
//  Aca vive la "forma" de los datos de toda la app.
//  Definir el tipo una sola vez = documentacion + autocompletado
//  + el editor te avisa si te equivocas de campo.
// ============================================================

// Una nota tal como existe en la base de datos.
export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string; // fecha en formato ISO (texto)
  updated_at: string;
};

// Los campos que el usuario puede editar de una nota.
// "Partial" significa "todos opcionales": podes actualizar solo el titulo,
// solo el contenido, o ambos.
export type NoteUpdate = Partial<Pick<Note, "title" | "content">>;
