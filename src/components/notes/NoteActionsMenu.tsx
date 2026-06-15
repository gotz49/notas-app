// ============================================================
//  NoteActionsMenu
// ------------------------------------------------------------
//  Menu flotante con las acciones de una nota (Keywords, Atajos,
//  Fijar/Quitar, Exportar, Borrar). Se reutiliza en dos lugares:
//   - como desplegable del boton hamburguesa en la barra del editor.
//   - como menu de clic derecho sobre una nota de la lista.
//  El padre decide la posicion via `style` y maneja el estado de
//  apertura; este componente solo avisa con `onClose`.
// ============================================================
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Note } from "../../types";
import styles from "./NoteActionsMenu.module.css";

type Props = {
  note: Note;
  style?: CSSProperties; // posicion (fixed en la lista, absolute en el editor)
  showKeywordsItem?: boolean; // las notas de gastos no tienen keywords
  keywordsLabel: string; // texto del item de keywords segun el contexto
  onKeywords: () => void;
  onHelp: () => void;
  onTogglePin: () => void;
  onExport: () => void;
  onDelete: () => void;
  onClose: () => void;
};

export function NoteActionsMenu({
  note,
  style,
  showKeywordsItem = true,
  keywordsLabel,
  onKeywords,
  onHelp,
  onTogglePin,
  onExport,
  onDelete,
  onClose,
}: Props) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Cerrar al hacer clic afuera o con Escape. El Escape se escucha en fase de
  // captura y detiene la propagacion para que solo cierre este menu y no
  // dispare ademas el "volver al inicio" global de App.
  useEffect(() => {
    const onClick = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  // Cada accion se ejecuta y cierra el menu.
  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  // En movil el menu va centrado en pantalla (con fondo atenuado), asi se ve
  // completo sin importar donde tocaste; en desktop sigue donde lo pone el
  // padre via `style` (junto al cursor o bajo el boton hamburguesa).
  const isMobile = !window.matchMedia("(min-width: 769px)").matches;
  const finalStyle: CSSProperties | undefined = isMobile
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(320px, calc(100vw - 32px))",
      }
    : style;

  return (
    <>
      {/* En movil, fondo atenuado detras del menu centrado (tap afuera = cerrar). */}
      {isMobile && <div className={styles.backdrop} onClick={onClose} />}
      {/* stopPropagation: que un clic dentro del menu no lo cierre antes de actuar. */}
      <div className={styles.menu} style={finalStyle} onClick={(e) => e.stopPropagation()}>
      {showKeywordsItem && (
        <button className={styles.item} onClick={run(onKeywords)}>{keywordsLabel}</button>
      )}
      <button className={styles.item} onClick={run(onHelp)}>Atajos</button>
      <button className={styles.item} onClick={run(onTogglePin)}>
        {/* Solo el emoji se achica: su hitbox quedaba mas alta que la del texto. */}
        <span className={styles.pinEmoji}>📌</span>
        {note.pinned ? "Quitar" : "Fijar"}
      </button>
      <button className={styles.item} onClick={run(onExport)}>Exportar</button>
      <div className={styles.sep} />
      {confirmDelete ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>¿Borrar?</span>
          <button className={`${styles.confirmBtn} ${styles.danger}`} onClick={run(onDelete)}>Sí</button>
          <button className={styles.confirmBtn} onClick={() => setConfirmDelete(false)}>No</button>
        </div>
      ) : (
        <button className={`${styles.item} ${styles.danger}`} onClick={() => setConfirmDelete(true)}>Borrar</button>
      )}
      </div>
    </>
  );
}
