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
  onSelect: (id: string) => void;
  // Clic derecho: abre el menu de acciones en (x, y). Lo maneja NoteList.
  onContext: (note: Note, x: number, y: number) => void;
};

export function NoteListItem({ note, active, onSelect, onContext }: Props) {
  const fecha = new Date(note.updated_at).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
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
        {note.pinned && <span className={styles.pin} aria-label="Fijada">📌</span>}
        {note.title || "Sin titulo"}
      </div>
      <div className={styles.itemDate}>{fecha}</div>
    </button>
  );
}
