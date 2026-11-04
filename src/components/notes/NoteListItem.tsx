// ============================================================
//  NoteListItem
// ------------------------------------------------------------
//  Una fila de la lista lateral. Es "tonto" (presentacional):
//  solo muestra datos y avisa cuando lo clickean. La logica vive
//  en el componente padre.
// ============================================================
import type { Note } from "../../types";
import styles from "./NoteList.module.css";

type Props = {
  note: Note;
  active: boolean;
  inTrash?: boolean; // en la papelera se muestra cuando se borro
  onSelect: (id: string) => void;
  // Clic derecho: abre el menu de acciones en (x, y). Lo maneja NoteList.
  onContext: (note: Note, x: number, y: number) => void;
};

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });

export function NoteListItem({ note, active, inTrash = false, onSelect, onContext }: Props) {
  const fecha =
    inTrash && note.deleted_at ? `Borrada el ${fechaCorta(note.deleted_at)}` : fechaCorta(note.updated_at);
  return (
    <button
      className={`${styles.item} ${active ? styles.itemActive : ""}`}
      onClick={() => onSelect(note.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(note, e.clientX, e.clientY);
      }}
    >
      <div className={styles.itemTitle}>
        {note.pinned && !inTrash && <span className={styles.pin} aria-label="Fijada">📌</span>}
        {note.kind === "gastos" && (
          <span className={styles.pin} aria-label="Lista de gastos">💲</span>
        )}
        {note.kind === "peso" && (
          <span className={styles.pin} aria-label="Registro de peso">⚖️</span>
        )}
        {note.title || "Sin titulo"}
      </div>
      <div className={styles.itemDate}>{fecha}</div>
    </button>
  );
}
