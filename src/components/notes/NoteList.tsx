// ============================================================
//  NoteList  (barra lateral)
// ------------------------------------------------------------
//  Muestra la marca, el boton "nueva nota", la lista de notas y
//  el pie con el email del usuario + cerrar sesion.
// ============================================================
import type { Note } from "../../types";
import { Button } from "../ui/Button";
import { NoteListItem } from "./NoteListItem";
import styles from "./NoteList.module.css";
import { ThemeToggle } from "../ui/ThemeToggle";

type Props = {
  notes: Note[];
  activeId: string | null;
  email: string | undefined;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSignOut: () => void;
};

export function NoteList({
  notes,
  activeId,
  email,
  onSelect,
  onCreate,
  onSignOut,
}: Props) {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Notas</span>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Button variant="ghost" onClick={onCreate}>+ Nueva</Button>
        </div>
      </div>

      <div className={styles.list}>
        {notes.length === 0 ? (
          <p className={styles.empty}>
            No tenes notas todavia.<br />Crea la primera con "+ Nueva".
          </p>
        ) : (
          notes.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              active={note.id === activeId}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      <div className={styles.footer}>
        <span className={styles.email}>{email}</span>
        <button className={styles.email} style={{ background: "none", border: "none", color: "var(--color-accent)" }} onClick={onSignOut}>
          Salir
        </button>
      </div>
    </aside>
  );
}
