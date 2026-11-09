// ============================================================
//  GastosEditor
// ------------------------------------------------------------
//  Editor de una nota de gastos mensuales. En vez del editor de texto,
//  muestra:
//   - una barra con el MES de la nota (‹ Noviembre 2026 ›), la
//     cotizacion del dolar (si hay renglones en USD) y "Cerrar mes";
//   - un RESUMEN: ingresos, gastos, saldo y lo que falta pagar, mas
//     avisos de vencimientos proximos;
//   - una o varias LISTAS (tarjetas, servicios...). Cada renglon tiene
//     check de pagado, concepto, monto y un menu "⋯" para marcarlo
//     como ingreso, ponerle cuota, "solo este mes" o dolares;
//   - el HISTORIAL de meses cerrados (grafico + tabla).
//
//  Toda la logica (totales, cuotas, cierre) vive en lib/gastos.ts.
//
//  Igual que el editor de texto, esto NO guarda solo: avisa cambios
//  con onChange (el padre, NoteEditor, los guarda con la cola de
//  autoguardado). El contenido se serializa a JSON y vive en note.content.
//
//  Mantenemos estado local (sembrado del content) para que tipear y
//  tildar sea instantaneo; el padre fuerza un remount con key al
//  cambiar de nota o adoptar una version remota.
// ============================================================
import { useState } from "react";
import type { GastosData, GastoLista, GastoRenglon } from "../../types";
import {
  cerrarMes,
  compararConAnterior,
  convertibles,
  convertirFormatoViejo,
  esIngreso,
  esMesValido,
  formatDiferencia,
  formatMonto,
  mesActual,
  nombreMes,
  nuevaLista,
  nuevoRenglon,
  parseGastos,
  resumen,
  serializeGastos,
  sumarMeses,
  tieneUSD,
  totalesLista,
  vencimientos,
} from "../../lib/gastos";
import { RenglonOpciones } from "./gastos/RenglonOpciones";
import { InputNumero } from "./gastos/InputNumero";
import { CerrarMesDialog } from "./gastos/CerrarMesDialog";
import { GastosHistorial } from "./gastos/GastosHistorial";
import styles from "./GastosEditor.module.css";

type Props = {
  content: string; // JSON con la forma GastosData
  onChange: (json: string) => void; // avisa el nuevo JSON al padre
  // En la papelera: no se puede cerrar el mes (el dialogo va por portal,
  // fuera del <fieldset disabled> que bloquea el resto).
  readOnly?: boolean;
};

// Avisa vencimientos que faltan como mucho estos dias (o ya vencidos).
const DIAS_AVISO_VENCIMIENTO = 5;

export function GastosEditor({ content, onChange, readOnly = false }: Props) {
  const [data, setData] = useState<GastosData>(() => parseGastos(content));
  // Cierre de mes: dialogo abierto y "Deshacer" despues de confirmar. La
  // vista previa se calcula siempre con los datos actuales (no una foto).
  const [cierreAbierto, setCierreAbierto] = useState(false);
  const [deshacer, setDeshacer] = useState<{ previo: GastosData; mes: string } | null>(null);

  // Punto unico de cambio: actualiza el estado local y avisa el JSON al padre.
  function commit(next: GastosData) {
    setData(next);
    onChange(serializeGastos(next));
  }

  // Cualquier edicion manual hace que "Deshacer cierre" ya no tenga sentido
  // (pisaria lo nuevo), asi que lo descartamos.
  function editar(next: GastosData) {
    setDeshacer(null);
    commit(next);
  }

  // --- Mes y cotizacion ---
  const mesNota = esMesValido(data.mes) ? data.mes : mesActual();
  function moverMes(n: number) {
    editar({ ...data, mes: sumarMeses(mesNota, n) });
  }
  function setCotizacion(n: number | undefined) {
    editar({ ...data, cotizacionUSD: n !== undefined && n > 0 ? n : undefined });
  }

  // --- Operaciones sobre listas ---
  function addLista() {
    editar({ ...data, listas: [...data.listas, nuevaLista("Lista")] });
  }
  function removeLista(lista: GastoLista) {
    const conDatos = lista.renglones.some((r) => r.concepto.trim() || r.monto);
    if (conDatos && !window.confirm(`¿Borrar la lista "${lista.titulo || "Lista"}" con todos sus renglones?`)) {
      return;
    }
    editar({ ...data, listas: data.listas.filter((l) => l.id !== lista.id) });
  }
  function mapLista(listaId: string, fn: (l: GastoLista) => GastoLista) {
    editar({
      ...data,
      listas: data.listas.map((l) => (l.id === listaId ? fn(l) : l)),
    });
  }
  function setLista(listaId: string, cambios: Partial<GastoLista>) {
    mapLista(listaId, (l) => ({ ...l, ...cambios }));
  }

  // --- Operaciones sobre renglones (dentro de una lista) ---
  function addRenglon(listaId: string) {
    mapLista(listaId, (l) => ({ ...l, renglones: [...l.renglones, nuevoRenglon()] }));
  }
  function removeRenglon(listaId: string, renglonId: string) {
    mapLista(listaId, (l) => ({
      ...l,
      renglones: l.renglones.filter((r) => r.id !== renglonId),
    }));
  }
  function setRenglon(listaId: string, renglonId: string, cambios: Partial<GastoRenglon>) {
    mapLista(listaId, (l) => ({
      ...l,
      renglones: l.renglones.map((r) => (r.id === renglonId ? { ...r, ...cambios } : r)),
    }));
  }

  // --- Cerrar mes ---
  const cierre = cierreAbierto && !readOnly ? cerrarMes(data) : null;
  function confirmarCierre() {
    if (readOnly) return;
    const final = cerrarMes(data); // con los datos de este momento
    setDeshacer({ previo: data, mes: final.cambios.mes });
    commit(final.data);
    setCierreAbierto(false);
  }
  function deshacerCierre() {
    if (!deshacer) return;
    commit(deshacer.previo);
    setDeshacer(null);
  }
  function borrarDelHistorial(mes: string) {
    editar({ ...data, historial: (data.historial ?? []).filter((h) => h.mes !== mes) });
  }

  // --- Datos derivados para mostrar ---
  const cot = data.cotizacionUSD ?? 0;
  const res = resumen(data);
  const conv = convertibles(data);
  const hayConversion = !data.ocultarConversion && (conv.cuotas > 0 || conv.negativos > 0);
  const avisosVence = vencimientos(data).filter((v) => v.dias <= DIAS_AVISO_VENCIMIENTO);
  const mostrarCotizacion = tieneUSD(data) || cot > 0;

  return (
    <div className={styles.gastos}>
      {/* Barra del mes */}
      <div className={styles.barraMes}>
        <div className={styles.mes}>
          <button
            type="button"
            className={styles.flechaMes}
            aria-label="Pasar la nota al mes anterior"
            title="Cambiar el mes de esta nota al anterior"
            onClick={() => moverMes(-1)}
          >
            ‹
          </button>
          {/* Una nota vieja sin mes muestra el mes actual (es el que usa
              "Cerrar mes"); se fija recien al moverlo o al cerrar. */}
          <span className={styles.nombreMes}>{nombreMes(mesNota)}</span>
          <button
            type="button"
            className={styles.flechaMes}
            aria-label="Pasar la nota al mes siguiente"
            title="Cambiar el mes de esta nota al siguiente"
            onClick={() => moverMes(1)}
          >
            ›
          </button>
        </div>

        {mostrarCotizacion && (
          <label className={styles.cotizacion}>
            <span>US$ 1 =</span>
            <InputNumero
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="cotización"
              valor={data.cotizacionUSD}
              onValor={setCotizacion}
            />
          </label>
        )}

        <button type="button" className={styles.cerrarMesBtn} onClick={() => setCierreAbierto(true)}>
          Cerrar mes
        </button>
      </div>

      {deshacer && (
        <div className={styles.aviso} role="status">
          <span>Cerraste {nombreMes(deshacer.mes)}. El resumen quedó en el historial.</span>
          <button type="button" className={styles.avisoBtn} onClick={deshacerCierre}>
            Deshacer
          </button>
        </div>
      )}

      {hayConversion && (
        <div className={styles.aviso}>
          <span>
            ¿Pasar al formato nuevo? Los totales no cambian.
            {conv.cuotas > 0 && (
              <span className={styles.avisoDetalle}>
                Cuotas escritas en el texto (van a avanzar solas al cerrar el mes):{" "}
                <em>{conv.conceptosCuotas.join(", ")}</em>
              </span>
            )}
            {conv.negativos > 0 && (
              <span className={styles.avisoDetalle}>
                Montos negativos que pasan a ingresos: <em>{conv.conceptosNegativos.join(", ")}</em>
              </span>
            )}
          </span>
          <span className={styles.avisoAcciones}>
            <button
              type="button"
              className={styles.avisoBtn}
              onClick={() => editar(convertirFormatoViejo(data))}
            >
              Convertir
            </button>
            <button
              type="button"
              className={styles.avisoBtnSecundario}
              onClick={() => editar({ ...data, ocultarConversion: true })}
            >
              No
            </button>
          </span>
        </div>
      )}

      {/* Resumen */}
      <dl className={styles.resumen}>
        <div>
          <dt>Ingresos</dt>
          <dd className={styles.positivo}>{formatMonto(res.ingresos)}</dd>
        </div>
        <div>
          <dt>Gastos</dt>
          <dd>{formatMonto(res.gastos)}</dd>
        </div>
        <div>
          <dt>Saldo</dt>
          <dd className={res.saldo < 0 ? styles.negativo : styles.positivo}>
            {formatMonto(res.saldo)}
          </dd>
        </div>
        <div>
          <dt>Falta pagar</dt>
          <dd className={res.pendiente > 0 ? styles.pendienteMonto : ""}>
            {formatMonto(res.pendiente)}
          </dd>
        </div>
      </dl>

      {res.faltaCotizacion && (
        <p className={styles.alerta}>
          Hay montos en dólares: cargá la cotización arriba para que se sumen.
        </p>
      )}

      {avisosVence.length > 0 && (
        <ul className={styles.vencimientos}>
          {avisosVence.map((v) => (
            <li key={v.listaId} className={v.dias < 0 ? styles.vencido : ""}>
              <strong>{v.titulo || "Lista"}</strong>{" "}
              {v.dias < 0
                ? `venció hace ${-v.dias} día${v.dias === -1 ? "" : "s"}`
                : v.dias === 0
                  ? "vence hoy"
                  : `vence en ${v.dias} día${v.dias === 1 ? "" : "s"}`}{" "}
              · falta {formatMonto(v.pendiente)}
            </li>
          ))}
        </ul>
      )}

      {/* Listas */}
      {data.listas.map((lista) => {
        const t = totalesLista(lista, cot);
        const comp = compararConAnterior(data, lista);
        return (
          <section key={lista.id} className={styles.lista}>
            <header className={styles.listaHeader}>
              <input
                className={styles.listaTitulo}
                value={lista.titulo}
                placeholder="Nombre de la lista"
                aria-label="Nombre de la lista"
                onChange={(e) => setLista(lista.id, { titulo: e.target.value })}
              />
              <label className={styles.vence} title="Día del mes en que vence el pago">
                <span>vence</span>
                <InputNumero
                  inputMode="numeric"
                  min={1}
                  max={31}
                  placeholder="día"
                  aria-label="Día de vencimiento"
                  valor={lista.vence}
                  onValor={(n) => {
                    if (n === undefined) setLista(lista.id, { vence: undefined });
                    // Un dia invalido (0, 35, 2.5) no se guarda; al salir del
                    // campo vuelve a mostrarse el guardado.
                    else if (Number.isInteger(n) && n >= 1 && n <= 31) setLista(lista.id, { vence: n });
                  }}
                />
              </label>
              <button
                type="button"
                className={styles.iconBtn}
                title="Borrar lista"
                aria-label="Borrar lista"
                onClick={() => removeLista(lista)}
              >
                🗑
              </button>
            </header>

            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th className={styles.colCheck} aria-label="Pagado">✓</th>
                  <th>Concepto</th>
                  <th className={styles.colMonto}>Monto</th>
                  <th className={styles.colAccion} aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {lista.renglones.map((r) => {
                  const ingreso = esIngreso(r);
                  // Un ingreso se muestra y se tipea en positivo (el "+" lo
                  // marca), tambien los negativos viejos sin tipo.
                  const valor = ingreso ? Math.abs(r.monto) : r.monto;
                  const clases = [r.pagado ? styles.pagado : "", ingreso ? styles.ingreso : ""]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <tr key={r.id} className={clases}>
                      <td className={styles.colCheck}>
                        <input
                          type="checkbox"
                          checked={r.pagado}
                          aria-label={ingreso ? "Cobrado" : "Pagado"}
                          onChange={(e) => setRenglon(lista.id, r.id, { pagado: e.target.checked })}
                        />
                      </td>
                      <td>
                        <div className={styles.concepto}>
                          <input
                            className={styles.inputConcepto}
                            value={r.concepto}
                            placeholder={ingreso ? "Concepto del ingreso" : "Concepto del gasto"}
                            aria-label="Concepto"
                            onChange={(e) => setRenglon(lista.id, r.id, { concepto: e.target.value })}
                          />
                          {r.cuota && (
                            <span
                              className={`${styles.chip} ${r.cuota.actual >= r.cuota.total ? styles.chipFin : ""}`}
                              title={
                                r.cuota.actual >= r.cuota.total
                                  ? "Última cuota: se borra al cerrar el mes"
                                  : `Cuota ${r.cuota.actual} de ${r.cuota.total}`
                              }
                            >
                              {r.cuota.actual}/{r.cuota.total}
                            </span>
                          )}
                          {r.soloEsteMes && (
                            <span className={styles.chip} title="Se borra al cerrar el mes">
                              este mes
                            </span>
                          )}
                          {r.moneda === "USD" && (
                            <span className={styles.chip} title="Monto en dólares">
                              US$
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.monto} title={ingreso ? "Ingreso" : undefined}>
                          <InputNumero
                            className={styles.inputMonto}
                            inputMode="decimal"
                            step="0.01"
                            placeholder="0"
                            aria-label="Monto"
                            valor={valor}
                            onValor={(n) => {
                              const monto = n ?? 0;
                              // Un ingreso (o un negativo viejo, que en la
                              // primera edicion queda marcado como ingreso)
                              // guarda el monto en positivo.
                              setRenglon(
                                lista.id,
                                r.id,
                                ingreso ? { tipo: "ingreso", monto: Math.abs(monto) } : { monto }
                              );
                            }}
                          />
                        </div>
                      </td>
                      <td className={styles.colAccion}>
                        <div className={styles.acciones}>
                          <RenglonOpciones
                            renglon={r}
                            onChange={(cambios) => setRenglon(lista.id, r.id, cambios)}
                          />
                          <button
                            type="button"
                            className={styles.iconBtn}
                            title="Borrar renglón"
                            aria-label="Borrar renglón"
                            onClick={() => removeRenglon(lista.id, r.id)}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <button type="button" className={styles.addBtn} onClick={() => addRenglon(lista.id)}>
                      + Renglón
                    </button>
                  </td>
                  <td className={styles.subtotal}>
                    <div>{formatMonto(t.neto)}</div>
                    {t.pendiente > 0 && t.pendiente < t.gastos && (
                      <div className={styles.subtotalDetalle}>falta {formatMonto(t.pendiente)}</div>
                    )}
                    {comp && Math.abs(comp.diferencia) >= 0.005 && (
                      <div
                        className={styles.subtotalDetalle}
                        title={`Diferencia contra ${nombreMes(comp.mes)}`}
                      >
                        {formatDiferencia(comp.diferencia)} vs {nombreMes(comp.mes, true)}
                      </div>
                    )}
                  </td>
                  <td className={styles.colAccion}></td>
                </tr>
              </tfoot>
            </table>
          </section>
        );
      })}

      <div className={styles.footer}>
        <button type="button" className={styles.addListaBtn} onClick={addLista}>
          + Agregar lista
        </button>
        <div className={styles.total}>
          {/* Sin ingresos cargados, el "saldo" seria solo los gastos en
              negativo: ahi mostramos el total de gastos, como antes. */}
          <span className={styles.totalLabel}>{res.ingresos > 0 ? "Saldo" : "Total gastos"}</span>
          <span
            className={`${styles.totalMonto} ${res.ingresos > 0 && res.saldo < 0 ? styles.negativo : ""}`}
          >
            {formatMonto(res.ingresos > 0 ? res.saldo : res.gastos)}
          </span>
        </div>
      </div>

      <GastosHistorial historial={data.historial ?? []} onBorrar={borrarDelHistorial} />

      {cierre && (
        <CerrarMesDialog
          cambios={cierre.cambios}
          onConfirm={confirmarCierre}
          onCancel={() => setCierreAbierto(false)}
        />
      )}
    </div>
  );
}
