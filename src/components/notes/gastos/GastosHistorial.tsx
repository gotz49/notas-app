// ============================================================
//  GastosHistorial
// ------------------------------------------------------------
//  Historial de meses cerrados de una nota de gastos: un grafico de
//  barras (ingresos vs gastos de los ultimos 12 meses) y una tabla con
//  el resumen de cada mes. Tocar un mes despliega el detalle por lista.
//  El grafico es SVG con variables CSS, asi respeta el modo claro y
//  oscuro sin dependencias.
// ============================================================
import { useState } from "react";
import type { ResumenMes } from "../../../types";
import { formatMonto, nombreMes } from "../../../lib/gastos";
import styles from "./GastosHistorial.module.css";

type Props = {
  historial: ResumenMes[]; // del mas viejo al mas nuevo
  onBorrar: (mes: string) => void;
};

const MESES_GRAFICO = 12;

export function GastosHistorial({ historial, onBorrar }: Props) {
  const [abierto, setAbierto] = useState<string | null>(null);
  if (historial.length === 0) return null;

  const ultimos = historial.slice(-MESES_GRAFICO);
  const masNuevoPrimero = [...historial].reverse();

  return (
    <section className={styles.historial} aria-labelledby="historial-titulo">
      <h3 id="historial-titulo" className={styles.titulo}>
        Historial
      </h3>

      <Grafico meses={ultimos} />

      <div className={styles.tablaWrap}>
      <table className={styles.tabla}>
        <thead>
          <tr>
            <th>Mes</th>
            <th className={styles.num}>Ingresos</th>
            <th className={styles.num}>Gastos</th>
            <th className={styles.num}>Saldo</th>
            <th aria-hidden="true"></th>
          </tr>
        </thead>
        <tbody>
          {masNuevoPrimero.map((h) => {
            const open = abierto === h.mes;
            return (
              <FilaMes
                key={h.mes}
                h={h}
                open={open}
                onToggle={() => setAbierto(open ? null : h.mes)}
                onBorrar={() => {
                  if (window.confirm(`¿Borrar ${nombreMes(h.mes)} del historial?`)) onBorrar(h.mes);
                }}
              />
            );
          })}
        </tbody>
      </table>
      </div>
    </section>
  );
}

function FilaMes({
  h,
  open,
  onToggle,
  onBorrar,
}: {
  h: ResumenMes;
  open: boolean;
  onToggle: () => void;
  onBorrar: () => void;
}) {
  return (
    <>
      <tr>
        <td>
          {/* No es un <button> a proposito: en la papelera el editor queda
              dentro de un <fieldset disabled> que apaga los botones, y ver
              el detalle de un mes tiene que seguir andando. */}
          <span
            role="button"
            tabIndex={0}
            className={styles.mesBtn}
            aria-expanded={open}
            onClick={onToggle}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }}
          >
            <span className={styles.flecha} aria-hidden="true">{open ? "▾" : "▸"}</span>
            {nombreMes(h.mes)}
          </span>
        </td>
        <td className={styles.num}>{formatMonto(h.ingresos)}</td>
        <td className={styles.num}>{formatMonto(h.gastos)}</td>
        <td className={`${styles.num} ${h.saldo < 0 ? styles.negativo : styles.positivo}`}>
          {formatMonto(h.saldo)}
        </td>
        <td className={styles.accion}>
          <button
            type="button"
            className={styles.iconBtn}
            title="Borrar del historial"
            aria-label={`Borrar ${nombreMes(h.mes)} del historial`}
            onClick={onBorrar}
          >
            ✕
          </button>
        </td>
      </tr>
      {open && (
        <tr className={styles.detalle}>
          <td colSpan={5}>
            <ul>
              {h.listas.map((l, i) => (
                <li key={i}>
                  <span>{l.titulo || "Lista"}</span>
                  <span className={styles.detalleMontos}>
                    {l.ingresos > 0 && (
                      <span className={styles.positivo}>+{formatMonto(l.ingresos)}</span>
                    )}
                    {l.gastos > 0 && <span>{formatMonto(l.gastos)}</span>}
                    {l.ingresos === 0 && l.gastos === 0 && <span>{formatMonto(0)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {h.pendiente > 0 && (
              <p className={styles.pendiente}>
                Quedó sin pagar al cerrar: {formatMonto(h.pendiente)}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// --- Grafico de barras: ingresos vs gastos por mes ---------------
const ANCHO = 600;
const ALTO = 180;
const PAD = { top: 12, bottom: 24, x: 8 };

function Grafico({ meses }: { meses: ResumenMes[] }) {
  const max = Math.max(1, ...meses.flatMap((m) => [m.ingresos, m.gastos]));
  const alto = ALTO - PAD.top - PAD.bottom;
  const columna = (ANCHO - PAD.x * 2) / meses.length;
  const barra = Math.min(22, columna * 0.32);

  return (
    <figure className={styles.grafico}>
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        role="img"
        aria-label="Ingresos y gastos por mes"
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          x1={PAD.x}
          x2={ANCHO - PAD.x}
          y1={PAD.top + alto}
          y2={PAD.top + alto}
          className={styles.eje}
        />
        {meses.map((m, i) => {
          const centro = PAD.x + columna * i + columna / 2;
          const hIng = (m.ingresos / max) * alto;
          const hGas = (m.gastos / max) * alto;
          return (
            <g key={m.mes}>
              <title>
                {`${nombreMes(m.mes)}: ingresos ${formatMonto(m.ingresos)}, gastos ${formatMonto(m.gastos)}`}
              </title>
              <rect
                className={styles.barraIngreso}
                x={centro - barra - 1}
                y={PAD.top + alto - hIng}
                width={barra}
                height={hIng}
                rx={2}
              />
              <rect
                className={styles.barraGasto}
                x={centro + 1}
                y={PAD.top + alto - hGas}
                width={barra}
                height={hGas}
                rx={2}
              />
              <text x={centro} y={ALTO - 6} textAnchor="middle" className={styles.etiqueta}>
                {nombreMes(m.mes, true)}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.leyenda}>
        <span>
          <i className={styles.puntoIngreso} /> Ingresos
        </span>
        <span>
          <i className={styles.puntoGasto} /> Gastos
        </span>
      </figcaption>
    </figure>
  );
}
