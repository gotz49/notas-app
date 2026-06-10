// ============================================================
//  GastosEditor
// ------------------------------------------------------------
//  Editor de una nota de gastos. En vez del editor de texto, muestra
//  una o varias LISTAS de gastos; cada lista es una tabla con:
//   - un check de "pagado" (para ir tildando lo que vas pagando),
//   - el concepto del gasto,
//   - el monto.
//  Cada lista suma su subtotal y abajo se ve el total general.
//
//  Igual que el editor de texto, esto NO guarda solo: avisa cambios
//  con onChange (el padre, NoteEditor, los guarda con debounce). El
//  contenido se serializa a JSON y vive en note.content.
//
//  Mantenemos estado local (sembrado del content) para que tipear y
//  tildar sea instantaneo; el padre fuerza un remount con key={note.id}
//  al cambiar de nota, asi que no hace falta re-sincronizar por prop.
// ============================================================
import { useState } from "react";
import type { GastosData, GastoLista, GastoRenglon } from "../../types";
import {
  formatMonto,
  nuevaLista,
  nuevoRenglon,
  parseGastos,
  serializeGastos,
  subtotalLista,
  totalGeneral,
} from "../../lib/gastos";
import styles from "./GastosEditor.module.css";

type Props = {
  content: string; // JSON con la forma GastosData
  onChange: (json: string) => void; // avisa el nuevo JSON al padre
};

export function GastosEditor({ content, onChange }: Props) {
  const [data, setData] = useState<GastosData>(() => parseGastos(content));

  // Punto unico de cambio: actualiza el estado local y avisa el JSON al padre.
  function commit(next: GastosData) {
    setData(next);
    onChange(serializeGastos(next));
  }

  // --- Operaciones sobre listas ---
  function addLista() {
    commit({ ...data, listas: [...data.listas, nuevaLista("Lista")] });
  }
  function removeLista(listaId: string) {
    commit({ ...data, listas: data.listas.filter((l) => l.id !== listaId) });
  }
  function setListaTitulo(listaId: string, titulo: string) {
    commit({
      ...data,
      listas: data.listas.map((l) => (l.id === listaId ? { ...l, titulo } : l)),
    });
  }

  // --- Operaciones sobre renglones (dentro de una lista) ---
  function mapLista(listaId: string, fn: (l: GastoLista) => GastoLista) {
    commit({
      ...data,
      listas: data.listas.map((l) => (l.id === listaId ? fn(l) : l)),
    });
  }
  function addRenglon(listaId: string) {
    mapLista(listaId, (l) => ({ ...l, renglones: [...l.renglones, nuevoRenglon()] }));
  }
  function removeRenglon(listaId: string, renglonId: string) {
    mapLista(listaId, (l) => ({
      ...l,
      renglones: l.renglones.filter((r) => r.id !== renglonId),
    }));
  }
  function setRenglon(
    listaId: string,
    renglonId: string,
    cambios: Partial<GastoRenglon>
  ) {
    mapLista(listaId, (l) => ({
      ...l,
      renglones: l.renglones.map((r) =>
        r.id === renglonId ? { ...r, ...cambios } : r
      ),
    }));
  }

  return (
    <div className={styles.gastos}>
      {data.listas.map((lista) => (
        <section key={lista.id} className={styles.lista}>
          <header className={styles.listaHeader}>
            <input
              className={styles.listaTitulo}
              value={lista.titulo}
              placeholder="Nombre de la lista"
              onChange={(e) => setListaTitulo(lista.id, e.target.value)}
            />
            <button
              className={styles.iconBtn}
              title="Borrar lista"
              aria-label="Borrar lista"
              onClick={() => removeLista(lista.id)}
            >
              🗑
            </button>
          </header>

          <table className={styles.tabla}>
            <thead>
              <tr>
                <th className={styles.colCheck} aria-label="Pagado">✓</th>
                <th className={styles.colConcepto}>Concepto</th>
                <th className={styles.colMonto}>Monto</th>
                <th className={styles.colAccion} aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {lista.renglones.map((r) => (
                <tr key={r.id} className={r.pagado ? styles.pagado : ""}>
                  <td className={styles.colCheck}>
                    <input
                      type="checkbox"
                      checked={r.pagado}
                      aria-label="Pagado"
                      onChange={(e) =>
                        setRenglon(lista.id, r.id, { pagado: e.target.checked })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.inputConcepto}
                      value={r.concepto}
                      placeholder="Concepto del gasto"
                      onChange={(e) =>
                        setRenglon(lista.id, r.id, { concepto: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={styles.inputMonto}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      value={r.monto || ""}
                      placeholder="0"
                      onChange={(e) =>
                        setRenglon(lista.id, r.id, {
                          monto: e.target.value === "" ? 0 : parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                  <td className={styles.colAccion}>
                    <button
                      className={styles.iconBtn}
                      title="Borrar renglón"
                      aria-label="Borrar renglón"
                      onClick={() => removeRenglon(lista.id, r.id)}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>
                  <button className={styles.addBtn} onClick={() => addRenglon(lista.id)}>
                    + Renglón
                  </button>
                </td>
                <td className={styles.subtotal}>{formatMonto(subtotalLista(lista))}</td>
                <td className={styles.colAccion}></td>
              </tr>
            </tfoot>
          </table>
        </section>
      ))}

      <div className={styles.footer}>
        <button className={styles.addListaBtn} onClick={addLista}>
          + Agregar lista
        </button>
        <div className={styles.total}>
          <span className={styles.totalLabel}>Total</span>
          <span className={styles.totalMonto}>{formatMonto(totalGeneral(data))}</span>
        </div>
      </div>
    </div>
  );
}
