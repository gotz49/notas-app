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
};

export function NoteEditor({ note, onChange, onDelete }: Props) {
  const [title, setTitle] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando cambia la nota seleccionada, sincronizamos el titulo local.
  useEffect(() => {
    setTitle(note?.title ?? "");
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
        <Button variant="ghost" onClick={() => setShowHelp(true)}>Atajos</Button>
        <Button variant="danger" onClick={() => onDelete(note.id)}>Borrar</Button>
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
