// ============================================================
//  NoteList  (barra lateral)
// ------------------------------------------------------------
//  Muestra la marca, el boton "nueva nota", la lista de notas y
//  el pie con el email del usuario + cerrar sesion.
// ============================================================
import { useState } from "react";
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
  // Texto de busqueda. Es estado de vista (solo filtra lo que se muestra),
  // por eso vive aca y no en un hook ni en App.
  const [query, setQuery] = useState("");

  // Filtra por titulo o contenido, sin distinguir mayusculas. Al contenido
  // le quitamos las etiquetas HTML para no matchear nombres de tags.
  const q = query.trim().toLowerCase();
  const visibles = q
    ? notes.filter((n) =>
        (n.title + " " + n.content.replace(/<[^>]*>/g, " "))
          .toLowerCase()
          .includes(q)
      )
    : notes;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Notas</span>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Button variant="ghost" onClick={onCreate}>+ Nueva</Button>
        </div>
      </div>

      <input
        className={styles.search}
        type="search"
        placeholder="Buscar notas..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.list}>
        {notes.length === 0 ? (
          <p className={styles.empty}>
            No tenes notas todavia.<br />Crea la primera con "+ Nueva".
          </p>
        ) : visibles.length === 0 ? (
          <p className={styles.empty}>Sin resultados para "{query.trim()}".</p>
        ) : (
          visibles.map((note) => (
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
