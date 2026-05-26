// ============================================================
//  ShortcutsHelp
// ------------------------------------------------------------
//  Ventana flotante con la referencia de atajos de teclado y de
//  los "atajos de markdown" (lo que escribis y se convierte solo).
//  Se abre/cierra desde el boton "Atajos" de la barra del editor.
// ============================================================
import styles from "./ShortcutsHelp.module.css";

// Atajos de teclado que trae TipTap por defecto.
const keyboard: [string, string][] = [
  ["Negrita", "Cmd/Ctrl + B"],
  ["Cursiva", "Cmd/Ctrl + I"],
  ["Tachado", "Cmd/Ctrl + Shift + S"],
  ["Codigo en linea", "Cmd/Ctrl + E"],
  ["Titulo 1 / 2 / 3", "Cmd/Ctrl + Alt + 1 / 2 / 3"],
  ["Lista con vinetas", "Cmd/Ctrl + Shift + 8"],
  ["Lista numerada", "Cmd/Ctrl + Shift + 7"],
  ["Cita", "Cmd/Ctrl + Shift + B"],
  ["Deshacer / Rehacer", "Cmd/Ctrl + Z / Shift + Z"],
];

// "Atajos de markdown": escribis esto al inicio de linea y se convierte.
const markdown: [string, string][] = [
  ["# texto", "Titulo 1"],
  ["## texto", "Titulo 2"],
  ["### texto", "Titulo 3"],
  ["- texto  (o *)", "Lista con vinetas"],
  ["1. texto", "Lista numerada"],
  ["> texto", "Cita"],
  ["**texto**", "Negrita"],
  ["*texto*", "Cursiva"],
  ["`texto`", "Codigo"],
  ["---", "Divisor"],
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    // El fondo oscurecido: clic afuera = cerrar
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <h2 className={styles.title}>Atajos de formato</h2>
          <button className={styles.close} onClick={onClose}>×</button>
        </div>

        <h3 className={styles.subtitle}>Escribiendo en markdown</h3>
        <p className={styles.note}>Escribi esto y se convierte solo:</p>
        <table className={styles.table}>
          <tbody>
            {markdown.map(([k, v]) => (
              <tr key={k}>
                <td><code className={styles.code}>{k}</code></td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className={styles.subtitle}>Atajos de teclado</h3>
        <table className={styles.table}>
          <tbody>
            {keyboard.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td><span className={styles.keys}>{v}</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className={styles.note}>
          Tambien podes hacer <strong>clic derecho</strong> sobre el texto para
          elegir un formato desde el menu.
        </p>
      </div>
    </div>
  );
}
