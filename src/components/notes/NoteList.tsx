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

  // Barra colapsada (solo desktop): la reduce a un riel angosto para ganar
  // espacio de lectura. El boton para colapsar/expandir esta oculto en movil.
  const [collapsed, setCollapsed] = useState(false);

  // Filtra por titulo o contenido, sin distinguir mayusculas. Al contenido
  // le quitamos las etiquetas HTML para no matchear nombres de tags.
  const q = query.trim().toLowerCase();
  const filtradas = q
    ? notes.filter((n) =>
        (n.title + " " + n.content.replace(/<[^>]*>/g, " "))
          .toLowerCase()
          .includes(q)
      )
    : notes;

  // Las fijadas arriba. El sort de JS es estable, asi que dentro de cada
  // grupo se respeta el orden por fecha que ya viene de la base.
  const visibles = [...filtradas].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned)
  );

  // Colapsada: riel angosto con solo el boton para volver a expandir.
  if (collapsed) {
    return (
      <aside className={`${styles.sidebar} ${styles.collapsed}`}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(false)}
          title="Mostrar la lista de notas"
          aria-label="Mostrar la lista de notas"
        >
          »
        </button>
      </aside>
    );
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.brand}>Notas</span>
        <div className={styles.headerActions}>
          <ThemeToggle />
          <Button variant="ghost" onClick={onCreate}>+ Nueva</Button>
          <button
            className={`${styles.collapseBtn} ${styles.collapseDesktop}`}
            onClick={() => setCollapsed(true)}
            title="Ocultar la lista de notas"
            aria-label="Ocultar la lista de notas"
          >
            «
          </button>
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
