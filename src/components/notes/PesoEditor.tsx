// ============================================================
//  PesoEditor
// ------------------------------------------------------------
//  Editor de una nota de peso. Arriba, un form para anotar el peso de
//  hoy (fecha + peso); al agregar, el registro se suma al listado de
//  abajo, ordenado del mas reciente al mas viejo. Cada renglon del
//  listado es editable (fecha y peso) y borrable, asi se puede cargar
//  un dia olvidado ("ayer") o corregir cualquier valor a mano.
//
//  Igual que los otros editores: NO guarda solo, avisa cambios con
//  onChange (el padre los guarda con debounce). El contenido se
//  serializa a JSON (PesoData) y vive en note.content. El padre fuerza
//  un remount con key={note.id} al cambiar de nota.
// ============================================================
import { useState } from "react";
import type { PesoData, PesoRegistro } from "../../types";
import {
  hoyISO,
  nuevoRegistro,
  ordenarPorFecha,
  parsePeso,
  serializePeso,
} from "../../lib/peso";
import styles from "./PesoEditor.module.css";

type Props = {
  content: string; // JSON con la forma PesoData
  onChange: (json: string) => void; // avisa el nuevo JSON al padre
};

export function PesoEditor({ content, onChange }: Props) {
  const [data, setData] = useState<PesoData>(() => parsePeso(content));
  // Estado del form de carga (peso de hoy o de la fecha elegida).
  const [fecha, setFecha] = useState(hoyISO());
  const [peso, setPeso] = useState("");

  // Punto unico de cambio: actualiza el estado local y avisa el JSON al padre.
  function commit(next: PesoData) {
    setData(next);
    onChange(serializePeso(next));
  }

  function agregar() {
    const n = parseFloat(peso);
    if (!fecha || !n || n <= 0) return; // sin fecha o peso valido, no hace nada
    commit({ registros: [...data.registros, nuevoRegistro(n, fecha)] });
    setPeso(""); // listo para el proximo; la fecha vuelve a hoy
    setFecha(hoyISO());
  }

  function setRegistro(id: string, cambios: Partial<PesoRegistro>) {
    commit({
      registros: data.registros.map((r) =>
        r.id === id ? { ...r, ...cambios } : r
      ),
    });
  }
  function removeRegistro(id: string) {
    commit({ registros: data.registros.filter((r) => r.id !== id) });
  }

  // El listado se muestra del mas reciente al mas viejo.
  const ordenados = ordenarPorFecha(data.registros);

  return (
    <div className={styles.peso}>
      {/* Form de carga */}
      <div className={styles.form}>
        <input
          className={styles.formFecha}
          type="date"
          value={fecha}
          max={hoyISO()}
          onChange={(e) => setFecha(e.target.value)}
        />
        <input
          className={styles.formPeso}
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="Peso (kg)"
          value={peso}
          onChange={(e) => setPeso(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") agregar();
          }}
        />
        <button className={styles.addBtn} onClick={agregar}>
          Agregar
        </button>
      </div>

      {/* Listado de registros */}
      {ordenados.length === 0 ? (
        <p className={styles.vacio}>
          Anotá tu primer peso arriba. Cada registro queda con su fecha y podés
          editarlo o agregar un día olvidado.
        </p>
      ) : (
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th className={styles.colFecha}>Fecha</th>
              <th className={styles.colPeso}>Peso (kg)</th>
              <th className={styles.colAccion} aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {ordenados.map((r) => (
              <tr key={r.id}>
                <td>
                  <input
                    className={styles.inputFecha}
                    type="date"
                    value={r.fecha}
                    max={hoyISO()}
                    onChange={(e) => setRegistro(r.id, { fecha: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    className={styles.inputPeso}
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    value={r.peso || ""}
                    placeholder="0"
                    onChange={(e) =>
                      setRegistro(r.id, {
                        peso:
                          e.target.value === ""
                            ? 0
                            : parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </td>
                <td className={styles.colAccion}>
                  <button
                    className={styles.iconBtn}
                    title="Borrar registro"
                    aria-label="Borrar registro"
                    onClick={() => removeRegistro(r.id)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
