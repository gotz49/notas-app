// ============================================================
//  Utilidades de texto (funciones puras, sin React ni Supabase)
// ============================================================

// Pasa a minusculas y quita tildes: "Título" -> "titulo".
// Se usa para buscar sin importar mayusculas ni acentos.
export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Convierte el HTML guardado en texto plano aproximado, para buscar
// dentro del contenido de las notas (sin matchear nombres de etiquetas).
export function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ") // etiquetas HTML (parrafos, fecha, desplegable, etc.)
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
