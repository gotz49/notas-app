// ============================================================
//  SERVICIO DE IMAGENES  (Supabase Storage)
// ------------------------------------------------------------
//  Las imagenes NO van en la base de datos: se suben a un bucket
//  de Storage y en la nota solo guardamos su URL. Asi la tabla
//  "notes" queda liviana y el realtime sigue trayendo solo texto.
//
//  Antes de subir, la imagen se comprime en el cliente (se reescala
//  y se recodifica a WebP). Una foto de varios MB queda en decenas
//  o cientos de KB, sin que se note en pantalla.
// ============================================================
import { supabase } from "../lib/supabase";

// Bucket publico. La nota guarda una URL directa (`<img src>`), por eso el
// bucket es publico; las rutas usan un UUID al azar para que no sean
// adivinables. Escribir/borrar SI esta restringido al dueno por RLS.
const BUCKET = "imagenes";

// Sube una imagen de nota y devuelve su URL publica.
export async function uploadNoteImage(
  file: File,
  userId: string
): Promise<string> {
  const blob = await compressImage(file);
  // Carpeta por usuario: las politicas RLS del bucket exigen que el primer
  // segmento de la ruta sea el id del usuario.
  const path = `${userId}/${crypto.randomUUID()}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "image/webp",
      cacheControl: "31536000", // 1 ano: la imagen nunca cambia (ruta unica)
    });
  if (error) throw error;

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Borra del Storage las imagenes que vivian en una nota (a partir de su HTML).
// Best-effort: se usa al borrar una nota para no dejar archivos huerfanos
// ocupando cuota. Si falla, no debe romper el borrado de la nota.
export async function deleteNoteImages(content: string): Promise<void> {
  const paths = extractImagePaths(content);
  if (paths.length === 0) return;
  await supabase.storage.from(BUCKET).remove(paths);
}

// ---- helpers privados --------------------------------------

// Reescala a un lado maximo y recodifica a WebP usando un <canvas>.
async function compressImage(
  file: File,
  maxSide = 1500,
  quality = 0.7
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  // Escala <= 1: nunca agrandamos, solo achicamos si hace falta.
  const escala = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", quality)
  );
  if (!blob) throw new Error("No se pudo comprimir la imagen.");
  return blob;
}

// De un HTML, devuelve las rutas (user_id/uuid.webp) de las imagenes que
// estan en NUESTRO bucket. Ignora imagenes externas (pegadas con URL ajena).
function extractImagePaths(content: string): string[] {
  const doc = new DOMParser().parseFromString(content, "text/html");
  const marca = `/storage/v1/object/public/${BUCKET}/`;
  const paths: string[] = [];
  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    const i = src.indexOf(marca);
    if (i !== -1) paths.push(decodeURIComponent(src.slice(i + marca.length)));
  });
  return paths;
}
