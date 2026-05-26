// ============================================================
//  NoteEditor
// ------------------------------------------------------------
//  El panel principal: edita titulo y contenido (en Markdown) y
//  permite alternar entre "Escribir" y "Vista previa".
//
//  Guarda con "debounce": espera ~600ms despues de que dejas de
//  teclear antes de mandar a la base, para no escribir en cada letra.
// ============================================================
import { useEffect, useRef, useState } from "react";
import type { Note, NoteUpdate } from "../../types";
import { Button } from "../ui/Button";
import { MarkdownPreview } from "./MarkdownPreview";
import styles from "./NoteEditor.module.css";

type Props = {
  note: Note | null;
  onChange: (id: string, changes: NoteUpdate) => void;
  onDelete: (id: string) => void;
};

export function NoteEditor({ note, onChange, onDelete }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando cambia la nota seleccionada, sincronizamos los inputs locales.
  useEffect(() => {
    setTitle(note?.title ?? "");
    setContent(note?.content ?? "");
    setTab("write");
  }, [note?.id]); // solo cuando cambia el id de la nota

  // Programa el guardado diferido (debounce).
  function scheduleSave(changes: NoteUpdate) {
    if (!note) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(note.id, changes), 600);
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
        <div className={styles.toggle}>
          <button
            className={`${styles.tab} ${tab === "write" ? styles.tabActive : ""}`}
            onClick={() => setTab("write")}
          >
            Escribir
          </button>
          <button
            className={`${styles.tab} ${tab === "preview" ? styles.tabActive : ""}`}
            onClick={() => setTab("preview")}
          >
            Vista previa
          </button>
        </div>
        <Button variant="danger" onClick={() => onDelete(note.id)}>Borrar</Button>
      </div>

      <div className={styles.body}>
        <div className={styles.inner}>
          {tab === "write" ? (
            <>
              <input
                className={styles.titleInput}
                value={title}
                placeholder="Sin titulo"
                onChange={(e) => {
                  setTitle(e.target.value);
                  scheduleSave({ title: e.target.value });
                }}
              />
              <textarea
                className={styles.contentInput}
                value={content}
                placeholder="Escribi en Markdown: # titulo, **negrita**, - listas..."
                onChange={(e) => {
                  setContent(e.target.value);
                  scheduleSave({ content: e.target.value });
                }}
              />
            </>
          ) : (
            <div className={styles.preview}>
              <h1>{title || "Sin titulo"}</h1>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
