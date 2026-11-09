// ============================================================
//  CerrarMesDialog
// ------------------------------------------------------------
//  Muestra lo que va a pasar al cerrar el mes ANTES de hacerlo:
//  el resumen que se guarda en el historial, las cuotas que avanzan,
//  lo que se borra (cuotas terminadas y gastos de "solo este mes") y
//  lo que quedo sin pagar. Confirmar aplica el cierre (el editor
//  despues ofrece "Deshacer").
// ============================================================
import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import type { CambiosCierre } from "../../../lib/gastos";
import { formatMonto, nombreMes } from "../../../lib/gastos";
import { usePopoverClose } from "../blocks/usePopoverClose";
import styles from "./CerrarMesDialog.module.css";

type Props = {
  cambios: CambiosCierre;
  onConfirm: () => void;
  onCancel: () => void;
};

function lista(items: { concepto: string; monto: number }[]): string {
  return items.map((s) => `${s.concepto} (${formatMonto(s.monto)})`).join(", ");
}

export function CerrarMesDialog({ cambios, onConfirm, onCancel }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelar = useCallback(() => onCancel(), [onCancel]);
  // Clic afuera o Escape cancelan (sin cerrar ademas la nota).
  usePopoverClose(panelRef, true, cancelar);

  const r = cambios.resumen;

  // Portal al <body>: el editor puede estar dentro de contenedores con
  // animaciones/transform que romperian el position: fixed del fondo.
  return createPortal(
    <div className={styles.backdrop}>
      <div
        className={styles.panel}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cerrar-mes-titulo"
      >
        <h2 id="cerrar-mes-titulo" className={styles.title}>
          Cerrar {nombreMes(cambios.mes)}
        </h2>

        <dl className={styles.resumen}>
          <div>
            <dt>Ingresos</dt>
            <dd>{formatMonto(r.ingresos)}</dd>
          </div>
          <div>
            <dt>Gastos</dt>
            <dd>{formatMonto(r.gastos)}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd className={r.saldo < 0 ? styles.negativo : styles.positivo}>
              {formatMonto(r.saldo)}
            </dd>
          </div>
        </dl>

        <ul className={styles.cambios}>
          <li>
            Se guarda este resumen en el historial
            {cambios.reemplazaHistorial && (
              <strong> (reemplaza el cierre anterior de {nombreMes(cambios.mes)})</strong>
            )}
            .
          </li>
          <li>Se destildan todos los renglones.</li>
          {cambios.avanzadas > 0 && (
            <li>
              Avanza{cambios.avanzadas === 1 ? "" : "n"} {cambios.avanzadas} cuota
              {cambios.avanzadas === 1 ? "" : "s"}.
            </li>
          )}
          {cambios.terminadas.length > 0 && (
            <li>
              Se borran las cuotas terminadas: <em>{cambios.terminadas.join(", ")}</em>.
            </li>
          )}
          {cambios.soloEsteMes.length > 0 && (
            <li>
              Se borran los gastos de solo este mes: <em>{cambios.soloEsteMes.join(", ")}</em>.
            </li>
          )}
          <li>La nota pasa a {nombreMes(cambios.mesSiguiente)}.</li>
        </ul>

        {cambios.faltaCotizacion && (
          <div className={styles.aviso} role="alert">
            <strong>Falta la cotización del dólar:</strong> los montos en US$ se
            van a guardar como 0 en el historial. Cancelá y cargala arriba.
          </div>
        )}

        {cambios.sinPagar.length > 0 && (
          <div className={styles.aviso}>
            <strong>Quedan sin pagar:</strong> {lista(cambios.sinPagar)}. Se van a
            destildar igual.
          </div>
        )}

        {cambios.borradosSinPagar.length > 0 && (
          <div className={styles.aviso}>
            <strong>Se borran aunque no están pagados:</strong>{" "}
            {lista(cambios.borradosSinPagar)}.
          </div>
        )}

        <div className={styles.acciones}>
          <button type="button" className={styles.secundario} onClick={onCancel} autoFocus>
            Cancelar
          </button>
          <button type="button" className={styles.primario} onClick={onConfirm}>
            Cerrar mes
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
