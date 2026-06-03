// ============================================================
//  NoteEditor
// ------------------------------------------------------------
//  Panel principal: titulo + cuerpo en un editor enriquecido
//  (una sola superficie, sin pestanas). El formato se aplica en
//  vivo mientras escribis.
//
//  Guarda con "debounce": espera ~600ms despues de que dejas de
//  teclear antes de mandar a la base, para no escribir en cada letra.
// ============================================================
import { useEffect, useRef, useState } from "react";
import type { Note, NoteUpdate } from "../../types";
import { Button } from "../ui/Button";
import { Editor } from "./Editor";
import { ShortcutsHelp } from "./ShortcutsHelp";
import styles from "./NoteEditor.module.css";

type Props = {
  note: Note | null;
  onChange: (id: string, changes: NoteUpdate) => void;
  onDelete: (id: string) => void;
  onBack?: () => void; // volver a la lista (solo visible en movil)
};

export function NoteEditor({ note, onChange, onDelete, onBack }: Props) {
  const [title, setTitle] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando cambia la nota seleccionada, sincronizamos el titulo local y
  // cancelamos cualquier confirmacion de borrado pendiente.
  useEffect(() => {
    setTitle(note?.title ?? "");
    setConfirmDelete(false);
  }, [note?.id]);

  // Programa el guardado diferido (debounce).
  function scheduleSave(changes: NoteUpdate) {
    if (!note) return;
    if (timer.current) clearTimeout(timer.current);
    const id = note.id;
    timer.current = setTimeout(() => onChange(id, changes), 600);
  }

  if (!note) {
    return (
      <main className={styles.editor}>
        <p className={styles.placeholder}>Selecciona o crea una nota para empezar.</p>
      </main>
    );
  }

  return (
    <main className={styles.editor}>
      <div className={styles.toolbar}>
        {/* Izquierda: volver a la lista (solo en movil, via .backBtn) */}
        <Button variant="ghost" className={styles.backBtn} onClick={onBack}>← Notas</Button>
        {/* Derecha: acciones de la nota */}
        <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
          <Button variant="ghost" onClick={() => setShowHelp(true)}>Atajos</Button>
          {confirmDelete ? (
            <>
              <span className={styles.confirmText}>¿Borrar?</span>
              <Button variant="danger" onClick={() => onDelete(note.id)}>Sí</Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
            </>
          ) : (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Borrar</Button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.inner}>
          <input
            className={styles.titleInput}
            value={title}
            placeholder="Sin titulo"
            onChange={(e) => {
              setTitle(e.target.value);
              scheduleSave({ title: e.target.value });
            }}
          />
          {/* key={note.id}: al cambiar de nota, el editor se reinicia
              limpio con el contenido de la nota nueva. */}
          <Editor
            key={note.id}
            content={note.content}
            onChange={(html) => scheduleSave({ content: html })}
          />
        </div>
      </div>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </main>
  );
}
