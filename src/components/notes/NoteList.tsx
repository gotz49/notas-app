// ============================================================
//  NoteList  (barra lateral)
// ------------------------------------------------------------
//  Muestra la marca, el boton "nueva nota", la lista de notas y
//  el pie con el email del usuario + cerrar sesion.
// ============================================================
import { useEffect, useState } from "react";
import type { Note } from "../../types";
import { Button } from "../ui/Button";
import { NoteListItem } from "./NoteListItem";
import { NoteActionsMenu } from "./NoteActionsMenu";
import { exportNote } from "./exportNote";
import styles from "./NoteList.module.css";
import { ThemeToggle } from "../ui/ThemeToggle";

type Props = {
  notes: Note[];
  activeId: string | null;
  email: string | undefined;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSignOut: () => void;
  // Acciones del menu de clic derecho sobre una nota.
  onTogglePin: (note: Note) => void;
  onDelete: (id: string) => void;
  onShowHelp: () => void;
  onOpenKeywords: (id: string) => void;
};

export function NoteList({
  notes,
  activeId,
  email,
  onSelect,
  onCreate,
  onSignOut,
  onTogglePin,
  onDelete,
  onShowHelp,
  onOpenKeywords,
}: Props) {
  // Menu contextual de clic derecho: la nota apuntada y su posicion.
  const [menu, setMenu] = useState<{ note: Note; x: number; y: number } | null>(
    null
  );
  // Texto de busqueda. Es estado de vista (solo filtra lo que se muestra),
  // por eso vive aca y no en un hook ni en App.
  const [query, setQuery] = useState("");

  // Barra colapsada (solo desktop): la reduce a un riel angosto para ganar
  // espacio de lectura. Se recuerda entre sesiones via localStorage. El CSS
  // limita el efecto a desktop (en movil la barra siempre se ve completa).
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true"
  );
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

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

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      {/* Boton para expandir: solo visible cuando la barra esta colapsada
          (en desktop). El CSS lo oculta en el resto de los casos. */}
      <button
        className={`${styles.collapseBtn} ${styles.expandBtn}`}
        onClick={() => setCollapsed(false)}
        title="Mostrar la lista de notas"
        aria-label="Mostrar la lista de notas"
      >
        »
      </button>

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
              onContext={(note, x, y) => setMenu({ note, x, y })}
            />
          ))
        )}
      </div>

      {/* Mismo menu de acciones que la hamburguesa del editor, en el cursor. */}
      {menu && (
        <NoteActionsMenu
          note={menu.note}
          style={{ position: "fixed", top: menu.y, left: menu.x }}
          keywordsLabel="Keywords"
          onKeywords={() => onOpenKeywords(menu.note.id)}
          onHelp={onShowHelp}
          onTogglePin={() => onTogglePin(menu.note)}
          onExport={() => exportNote(menu.note)}
          onDelete={() => onDelete(menu.note.id)}
          onClose={() => setMenu(null)}
        />
      )}

      <div className={styles.footer}>
        <span className={styles.email}>{email}</span>
        <button className={styles.email} style={{ background: "none", border: "none", color: "var(--color-accent)" }} onClick={onSignOut}>
          Salir
        </button>
      </div>
    </aside>
  );
}
