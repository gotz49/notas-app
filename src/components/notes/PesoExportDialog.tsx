// ============================================================
//  PesoExportDialog
// ------------------------------------------------------------
//  Modal para exportar una nota de peso como IMAGEN (PNG) con un
//  grafico de la evolucion del peso. Se elige un rango de fechas
//  (desde/hasta, inclusive) con presets rapidos (7 / 30 dias / todo),
//  se ve una vista previa en vivo y se descarga o comparte la imagen.
//
//  El grafico lo pinta dibujarGraficoPeso() en un <canvas>; el PNG
//  sale de leer ese mismo canvas con toBlob(). Sin dependencias.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import type { Note } from "../../types";
import { hoyISO, ordenarPorFecha, parsePeso, registrosEnRango } from "../../lib/peso";
import { dibujarGraficoPeso } from "../../lib/pesoChart";
import styles from "./PesoExportDialog.module.css";

// Resta dias a una fecha 'YYYY-MM-DD' y devuelve otra 'YYYY-MM-DD' (local).
function restarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const fecha = new Date(a, m - 1, d - dias);
  const off = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha.getTime() - off).toISOString().slice(0, 10);
}

export function PesoExportDialog({ note, onClose }: { note: Note; onClose: () => void }) {
  const registros = useMemo(() => parsePeso(note.content).registros, [note.content]);

  // Rango de fechas disponible (para los limites y el preset "Todo").
  const ordenadosAsc = ordenarPorFecha(registros, true);
  const fechaMin = ordenadosAsc[0]?.fecha ?? hoyISO();
  const fechaMax = ordenadosAsc[ordenadosAsc.length - 1]?.fecha ?? hoyISO();

  // Por defecto: todo el rango con datos.
  const [desde, setDesde] = useState(fechaMin);
  const [hasta, setHasta] = useState(fechaMax);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Si el usuario invierte las fechas, las ordenamos para filtrar/dibujar.
  const lo = desde <= hasta ? desde : hasta;
  const hi = desde <= hasta ? hasta : desde;
  const puntos = ordenarPorFecha(registrosEnRango(registros, lo, hi), true);

  // Redibuja la vista previa cada vez que cambia el rango o los datos.
  useEffect(() => {
    if (canvasRef.current) {
      dibujarGraficoPeso(canvasRef.current, puntos, {
        titulo: note.title || "Peso",
        desde: lo,
        hasta: hi,
      });
    }
  }, [note.title, lo, hi, puntos]);

  const nombreArchivo = `peso_${lo}_${hi}.png`;

  function conBlob(fn: (blob: Blob) => void) {
    canvasRef.current?.toBlob((blob) => {
      if (blob) fn(blob);
    }, "image/png");
  }

  function descargar() {
    conBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Compartir nativo (Android): abre la hoja de compartir con la imagen, para
  // mandarla directo por WhatsApp/mail. Solo si el navegador lo soporta.
  const puedeCompartir = typeof navigator !== "undefined" && !!navigator.canShare;
  function compartir() {
    conBlob(async (blob) => {
      const file = new File([blob], nombreArchivo, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: note.title || "Peso" });
        } catch {
          /* el usuario cancelo la hoja de compartir */
        }
      } else {
        descargar(); // sin soporte de archivos: cae a descargar
      }
    });
  }

  // Presets: ultimos N dias hasta hoy, o todo el rango con datos.
  function ultimosDias(n: number) {
    setHasta(hoyISO());
    setDesde(restarDias(hoyISO(), n - 1));
  }
  function todo() {
    setDesde(fechaMin);
    setHasta(fechaMax);
  }

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>Exportar gráfico</h2>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        {/* Presets de rango */}
        <div className={styles.presets}>
          <button className={styles.preset} onClick={() => ultimosDias(7)}>7 días</button>
          <button className={styles.preset} onClick={() => ultimosDias(30)}>30 días</button>
          <button className={styles.preset} onClick={todo}>Todo</button>
        </div>

        {/* Rango manual */}
        <div className={styles.rango}>
          <label className={styles.campo}>
            <span>Desde</span>
            <input type="date" value={desde} max={hoyISO()} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label className={styles.campo}>
            <span>Hasta</span>
            <input type="date" value={hasta} max={hoyISO()} onChange={(e) => setHasta(e.target.value)} />
          </label>
        </div>

        {/* Vista previa */}
        <div className={styles.preview}>
          <canvas ref={canvasRef} className={styles.canvas} />
        </div>

        {/* Acciones */}
        <div className={styles.acciones}>
          <button className={styles.secundario} onClick={descargar} disabled={puntos.length === 0}>
            Descargar
          </button>
          {puedeCompartir && (
            <button className={styles.primario} onClick={compartir} disabled={puntos.length === 0}>
              Compartir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
