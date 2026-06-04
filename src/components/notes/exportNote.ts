// ============================================================
//  exportNote
// ------------------------------------------------------------
//  Descarga una nota como .txt: convierte el HTML del cuerpo a
//  texto plano y antepone el titulo. Se usa desde el menu de
//  acciones, tanto en el editor como en el clic derecho de la lista.
// ============================================================
import type { Note } from "../../types";

export function exportNote(note: Note) {
  const cuerpo =
    new DOMParser().parseFromString(note.content, "text/html").body
      .textContent ?? "";
  const texto = `${note.title}\n\n${cuerpo}`.trim() + "\n";
  const nombre = (note.title.trim() || "nota").replace(/[\\/:*?"<>|]/g, "_");
  const url = URL.createObjectURL(
    new Blob([texto], { type: "text/plain;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
