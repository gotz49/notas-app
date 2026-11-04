/* eslint-disable */
// Imagenes FALSAS (solo para "npm run dev:demo"): reemplaza a
// src/services/images.service.ts. No sube nada: usa una URL local
// temporal del navegador (se pierde al recargar).
export async function uploadNoteImage(file: File, _userId: string): Promise<string> {
  return URL.createObjectURL(file);
}
export async function deleteNoteImages(_content: string): Promise<void> {}
