// ============================================================
//  pesoChart  (dibuja el grafico de peso en un <canvas>)
// ------------------------------------------------------------
//  Logica de dibujo pura: recibe un canvas y los registros (ya
//  filtrados por rango y ordenados ascendente por fecha) y pinta una
//  linea de tiempo del peso. Sin dependencias: todo con la API 2D del
//  canvas, igual que la compresion de imagenes. El export a PNG sale
//  de leer este mismo canvas con toBlob().
//
//  Eje X = tiempo; eje Y = peso. El eje Y se autoajusta al rango de los
//  datos con un margen fijo (p. ej. 85-86 -> eje de 82 a 89).
// ============================================================
import type { PesoRegistro } from "../types";
import { formatFecha, formatPeso } from "./peso";

// Margen (en kg) que se agrega arriba y abajo del rango real de pesos para que
// la linea no quede pegada a los bordes. Tu ejemplo: 85-86 -> 82 a 89.
const MARGEN_KG = 3;

// Tamano logico del grafico (en px CSS). El canvas se renderiza a mayor
// resolucion (ESCALA) para que el PNG salga nitido.
const ANCHO = 820;
const ALTO = 460;
const ESCALA = 2;

const PAD = { top: 64, right: 28, bottom: 56, left: 56 };

type Opciones = { titulo: string; desde: string; hasta: string };

// Convierte 'YYYY-MM-DD' a un numero de tiempo (local) para ubicar en el eje X.
function tiempo(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d).getTime();
}

// Elige un "paso lindo" (1, 2, 5 x 10^n) para las marcas del eje Y.
function pasoLindo(rango: number, objetivo = 6): number {
  const bruto = rango / objetivo;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const paso = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return paso * mag;
}

export function dibujarGraficoPeso(
  canvas: HTMLCanvasElement,
  puntos: PesoRegistro[],
  opts: Opciones
): void {
  // Resolucion real (nitida) vs tamano CSS.
  canvas.width = ANCHO * ESCALA;
  canvas.height = ALTO * ESCALA;
  canvas.style.width = "100%";
  canvas.style.height = "auto";

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(ESCALA, ESCALA);

  // Fondo blanco siempre (la imagen se manda por fuera de la app, no debe
  // depender del tema claro/oscuro).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, ANCHO, ALTO);

  // --- Titulo y subtitulo ---
  ctx.fillStyle = "#111827";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = "600 20px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.titulo || "Peso", PAD.left, 30);

  ctx.fillStyle = "#6b7280";
  ctx.font = "13px system-ui, -apple-system, sans-serif";
  const subt = subtitulo(puntos, opts);
  ctx.fillText(subt, PAD.left, 50);

  const plot = {
    x: PAD.left,
    y: PAD.top,
    w: ANCHO - PAD.left - PAD.right,
    h: ALTO - PAD.top - PAD.bottom,
  };

  // Sin datos: mensaje centrado y salir.
  if (puntos.length === 0) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "15px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(
      "Sin registros en el rango elegido.",
      plot.x + plot.w / 2,
      plot.y + plot.h / 2
    );
    return;
  }

  // --- Rango del eje Y (peso) con margen ---
  const pesos = puntos.map((p) => p.peso);
  const minReal = Math.min(...pesos);
  const maxReal = Math.max(...pesos);
  const minY = Math.floor(minReal) - MARGEN_KG;
  const maxY = Math.ceil(maxReal) + MARGEN_KG;
  const rangoY = maxY - minY || 1;

  // --- Rango del eje X (tiempo) ---
  const ts = puntos.map((p) => tiempo(p.fecha));
  const tMin = Math.min(...ts);
  const tMax = Math.max(...ts);
  const rangoT = tMax - tMin;

  const py = (peso: number) => plot.y + plot.h - ((peso - minY) / rangoY) * plot.h;
  const px = (t: number) =>
    rangoT === 0 ? plot.x + plot.w / 2 : plot.x + ((t - tMin) / rangoT) * plot.w;

  // --- Grilla + marcas del eje Y ---
  ctx.strokeStyle = "#e5e7eb";
  ctx.fillStyle = "#6b7280";
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  const paso = pasoLindo(rangoY);
  const primera = Math.ceil(minY / paso) * paso;
  for (let v = primera; v <= maxY + 1e-9; v += paso) {
    const y = py(v);
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.fillText(formatPeso(v), plot.x - 8, y);
  }

  // --- Marcas del eje X (fechas) ---
  // Si hay muchos puntos, etiquetamos solo algunos para no amontonar.
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const maxLabels = 7;
  const cadaCuantos = Math.ceil(puntos.length / maxLabels);
  puntos.forEach((p, i) => {
    if (i % cadaCuantos !== 0 && i !== puntos.length - 1) return;
    const x = px(tiempo(p.fecha));
    ctx.fillStyle = "#6b7280";
    ctx.fillText(formatFecha(p.fecha), x, plot.y + plot.h + 8);
  });

  // --- Eje (lineas base) ---
  ctx.strokeStyle = "#9ca3af";
  ctx.beginPath();
  ctx.moveTo(plot.x, plot.y);
  ctx.lineTo(plot.x, plot.y + plot.h);
  ctx.lineTo(plot.x + plot.w, plot.y + plot.h);
  ctx.stroke();

  // --- Linea de peso ---
  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  puntos.forEach((p, i) => {
    const x = px(tiempo(p.fecha));
    const y = py(p.peso);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // --- Puntos + etiqueta de valor (si no son demasiados) ---
  const etiquetar = puntos.length <= 14;
  ctx.fillStyle = "#2563eb";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  puntos.forEach((p) => {
    const x = px(tiempo(p.fecha));
    const y = py(p.peso);
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (etiquetar) {
      ctx.fillStyle = "#111827";
      ctx.font = "11px system-ui, -apple-system, sans-serif";
      ctx.fillText(formatPeso(p.peso), x, y - 7);
      ctx.fillStyle = "#2563eb";
    }
  });
}

// Subtitulo: unidad + rango de fechas + variacion (primer vs ultimo peso).
function subtitulo(puntos: PesoRegistro[], opts: Opciones): string {
  const rango = `${formatFecha(opts.desde)} – ${formatFecha(opts.hasta)}`;
  if (puntos.length === 0) return `Peso (kg) · ${rango}`;
  const primero = puntos[0].peso;
  const ultimo = puntos[puntos.length - 1].peso;
  const delta = ultimo - primero;
  const signo = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const variacion =
    puntos.length > 1
      ? ` · ${formatPeso(primero)} → ${formatPeso(ultimo)} kg (${signo}${formatPeso(Math.abs(delta))})`
      : "";
  return `Peso (kg) · ${rango}${variacion}`;
}
