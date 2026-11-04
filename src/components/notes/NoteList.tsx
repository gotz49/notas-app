// ============================================================
//  NoteList  (barra lateral)
// ------------------------------------------------------------
//  Muestra la marca, el boton "nueva nota", el buscador, las
//  pestanas "Notas" / "Papelera", la lista de notas y el pie con el
//  email del usuario + cerrar sesion.
//
//  Recibe TODAS las notas; que se muestra (vista, busqueda y orden)
//  lo decide utils/notes.ts -> selectVisibleNotes.
// ============================================================
import { useEffect, useState } from "react";
import type { Note, NoteKind } from "../../types";
import { countTrash, selectVisibleNotes, type NotesView } from "../../utils/notes";
import { Button } from "../ui/Button";
import { NoteListItem } from "./NoteListItem";
import { NoteActionsMenu } from "./NoteActionsMenu";
import styles from "./NoteList.module.css";
import { ThemeToggle } from "../ui/ThemeToggle";

type Props = {
  notes: Note[];
  activeId: string | null;
  email: string | undefined;
  onSelect: (id: string) => void;
  onCreate: (kind: NoteKind) => void;
  onSignOut: () => void;
  // Acciones del menu de clic derecho sobre una nota.
  onTogglePin: (note: Note) => void;
  onDelete: (id: string) => void;
  onShowHelp: () => void;
  onOpenKeywords: (id: string) => void;
  onExport: (note: Note) => void;
  // Papelera: que pestana se ve y vaciarla.
  view: NotesView;
  onViewChange: (view: NotesView) => void;
  onEmptyTrash: () => void;
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
  onExport,
  view,
  onViewChange,
  onEmptyTrash,
}: Props) {
  const inTrash = view === "trash";
  // Menu contextual de clic derecho: la nota apuntada y su posicion.
  const [menu, setMenu] = useState<{ note: Note; x: number; y: number } | null>(
    null
  );
  // Texto de busqueda. Es estado de vista (solo filtra lo que se muestra),
  // por eso vive aca y no en un hook ni en App.
  const [query, setQuery] = useState("");

  // Menu desplegable del boton "+ Nueva": elegir entre nota normal o de gastos.
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (!createOpen) return;
    const close = () => setCreateOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setCreateOpen(false);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [createOpen]);

  // Barra colapsada (solo desktop): la reduce a un riel angosto para ganar
  // espacio de lectura. Se recuerda entre sesiones via localStorage. El CSS
  // limita el efecto a desktop (en movil la barra siempre se ve completa).
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true"
  );
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(collapsed));
  }, [collapsed]);

  // Notas de la pestana actual, filtradas por titulo/contenido/keywords (sin
  // distinguir mayusculas ni tildes) y ordenadas: fijadas arriba y despues
  // la ultima edicion; en la papelera, la ultima borrada arriba.
  const visibles = selectVisibleNotes(notes, view, query);
  const trashCount = countTrash(notes);
  const hayEnVista = notes.some((n) => (inTrash ? n.deleted_at !== null : n.deleted_at === null));

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
          {/* "+ Nueva" abre un menu para elegir nota normal o lista de gastos. */}
          <div className={styles.createWrap}>
            <Button
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded={createOpen}
              onClick={(e) => {
                e.stopPropagation();
                setCreateOpen((v) => !v);
              }}
            >
              + Nueva
            </Button>
            {createOpen && (
              <div className={styles.createMenu} onClick={(e) => e.stopPropagation()}>
                <button
                  className={styles.createItem}
                  onClick={() => {
                    setCreateOpen(false);
                    onCreate("nota");
                  }}
                >
                  📝 Nota
                </button>
                <button
                  className={styles.createItem}
                  onClick={() => {
                    setCreateOpen(false);
                    onCreate("gastos");
                  }}
                >
                  💲 Lista de gastos
                </button>
                <button
                  className={styles.createItem}
                  onClick={() => {
                    setCreateOpen(false);
                    onCreate("peso");
                  }}
                >
                  ⚖️ Registro de peso
                </button>
              </div>
            )}
          </div>
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
        placeholder={inTrash ? "Buscar en la papelera..." : "Buscar notas..."}
        aria-label="Buscar notas"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={!inTrash}
          className={`${styles.tab} ${!inTrash ? styles.tabActive : ""}`}
          onClick={() => onViewChange("notes")}
        >
          Notas
        </button>
        <button
          role="tab"
          aria-selected={inTrash}
          className={`${styles.tab} ${inTrash ? styles.tabActive : ""}`}
          onClick={() => onViewChange("trash")}
        >
          Papelera{trashCount > 0 ? ` (${trashCount})` : ""}
        </button>
      </div>

      <div className={styles.list}>
        {!hayEnVista ? (
          inTrash ? (
            <p className={styles.empty}>La papelera está vacía.</p>
          ) : (
            <p className={styles.empty}>
              No tenés notas todavía.<br />Creá la primera con "+ Nueva".
            </p>
          )
        ) : visibles.length === 0 ? (
          <p className={styles.empty}>Sin resultados para "{query.trim()}".</p>
        ) : (
          visibles.map((note) => (
            <NoteListItem
              key={note.id}
              note={note}
              active={note.id === activeId}
              inTrash={inTrash}
              onSelect={onSelect}
              // En la papelera no hay menu de clic derecho: las acciones
              // (Restaurar / Borrar para siempre) estan al abrir la nota.
              onContext={(note, x, y) => !inTrash && setMenu({ note, x, y })}
            />
          ))
        )}
      </div>

      {inTrash && trashCount > 0 && (
        <div className={styles.trashBar}>
          <Button variant="danger" onClick={onEmptyTrash}>
            Vaciar papelera
          </Button>
        </div>
      )}

      {/* Mismo menu de acciones que la hamburguesa del editor, en el cursor. */}
      {menu && (
        <NoteActionsMenu
          note={menu.note}
          style={{ position: "fixed", top: menu.y, left: menu.x }}
          keywordsLabel="Keywords"
          onKeywords={() => onOpenKeywords(menu.note.id)}
          onHelp={onShowHelp}
          onTogglePin={() => onTogglePin(menu.note)}
          onExport={() => onExport(menu.note)}
          onDelete={() => onDelete(menu.note.id)}
          onClose={() => setMenu(null)}
        />
      )}

      <div className={styles.footer}>
        <span className={styles.email} title={email}>
          {email}
        </span>
        <button className={styles.signOut} onClick={onSignOut}>
          Salir
        </button>
      </div>
    </aside>
  );
}
