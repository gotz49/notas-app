// ============================================================
//  RenglonOpciones
// ------------------------------------------------------------
//  Boton "⋯" de cada renglon de gastos. Abre un popover para elegir:
//   - si es gasto o ingreso,
//   - la cuota (5 de 12), que avanza sola al cerrar el mes,
//   - "solo este mes" (se borra al cerrar el mes),
//   - si el monto esta en dolares.
//  No guarda nada: avisa los cambios con onChange (el editor los
//  aplica al renglon y los guarda como cualquier otra edicion).
// ============================================================
import { useCallback, useRef, useState } from "react";
import type { GastoRenglon } from "../../../types";
import { esIngreso } from "../../../lib/gastos";
import { usePopoverClose } from "../blocks/usePopoverClose";
import styles from "./RenglonOpciones.module.css";

type Props = {
  renglon: GastoRenglon;
  onChange: (cambios: Partial<GastoRenglon>) => void;
};

// Lee un entero positivo de un input; vacio o invalido -> null.
function entero(valor: string): number | null {
  const n = parseInt(valor, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function RenglonOpciones({ renglon: r, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  usePopoverClose(ref, open, close);

  const ingreso = esIngreso(r);
  const monto = Math.abs(Number(r.monto) || 0);

  // Cambiar de tipo deja el monto en positivo: el signo lo da el tipo.
  function setTipo(tipo: "gasto" | "ingreso") {
    onChange({ tipo, monto });
  }

  // Borrador de los dos inputs de cuota: se puede tipear uno antes que el
  // otro sin perderlo. Se guarda en el renglon solo cuando hay un total
  // valido (si falta la cuota actual, se toma 1).
  const [borrador, setBorrador] = useState({
    actual: r.cuota ? String(r.cuota.actual) : "",
    total: r.cuota ? String(r.cuota.total) : "",
  });

  function setCuota(campo: "actual" | "total", valor: string) {
    const next = { ...borrador, [campo]: valor };
    setBorrador(next);
    const total = entero(next.total);
    if (!total) {
      if (r.cuota) onChange({ cuota: undefined });
      return;
    }
    const actual = entero(next.actual) ?? 1;
    // Mientras se tipea (p. ej. el total "12" pasa por "1") la cuota puede
    // quedar invalida: no se guarda hasta que actual <= total.
    if (actual > total) return;
    onChange({ cuota: { actual, total } });
  }

  const cuotaInvalida =
    (entero(borrador.actual) ?? 0) > (entero(borrador.total) ?? Infinity);

  function quitarCuota() {
    setBorrador({ actual: "", total: "" });
    onChange({ cuota: undefined });
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        title="Opciones del renglón"
        aria-label="Opciones del renglón"
        aria-expanded={open}
        onClick={() => {
          // Al abrir, el borrador arranca de lo guardado (la cuota pudo
          // cambiar sola, p. ej. al cerrar el mes).
          if (!open) {
            setBorrador({
              actual: r.cuota ? String(r.cuota.actual) : "",
              total: r.cuota ? String(r.cuota.total) : "",
            });
          }
          setOpen(!open);
        }}
      >
        ⋯
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label="Opciones del renglón">
          <div className={styles.grupo}>
            <span className={styles.etiqueta}>Tipo</span>
            <div className={styles.segmentado}>
              <button
                type="button"
                className={!ingreso ? styles.activo : ""}
                aria-pressed={!ingreso}
                onClick={() => setTipo("gasto")}
              >
                Gasto
              </button>
              <button
                type="button"
                className={ingreso ? styles.activo : ""}
                aria-pressed={ingreso}
                onClick={() => setTipo("ingreso")}
              >
                Ingreso
              </button>
            </div>
          </div>

          <div className={styles.grupo}>
            <span className={styles.etiqueta}>Cuota</span>
            <div className={styles.cuota}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label="Cuota actual"
                aria-invalid={cuotaInvalida}
                placeholder="—"
                value={borrador.actual}
                onChange={(e) => setCuota("actual", e.target.value)}
              />
              <span>de</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label="Total de cuotas"
                placeholder="—"
                value={borrador.total}
                onChange={(e) => setCuota("total", e.target.value)}
              />
              {(r.cuota || borrador.actual || borrador.total) && (
                <button
                  type="button"
                  className={styles.quitar}
                  onClick={quitarCuota}
                >
                  Quitar
                </button>
              )}
            </div>
            {cuotaInvalida ? (
              <span className={styles.error} role="alert">
                La cuota actual no puede ser mayor que el total.
              </span>
            ) : (
              <span className={styles.ayuda}>Avanza sola al cerrar el mes y se borra al terminar.</span>
            )}
          </div>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={!!r.soloEsteMes}
              onChange={(e) => onChange({ soloEsteMes: e.target.checked || undefined })}
            />
            <span>
              Solo este mes
              <span className={styles.ayuda}>Se borra al cerrar el mes.</span>
            </span>
          </label>

          <label className={styles.check}>
            <input
              type="checkbox"
              checked={r.moneda === "USD"}
              onChange={(e) => onChange({ moneda: e.target.checked ? "USD" : undefined })}
            />
            <span>
              En dólares (US$)
              <span className={styles.ayuda}>Se convierte con la cotización del mes.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
