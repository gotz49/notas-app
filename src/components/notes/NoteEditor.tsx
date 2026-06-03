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

// Estado del indicador de guardado que se muestra en la toolbar.
type SaveStatus = "idle" | "saving" | "saved";

type Props = {
  note: Note | null;
  onChange: (id: string, changes: NoteUpdate) => void | Promise<unknown>;
  onDelete: (id: string) => void;
  onBack?: () => void; // volver a la lista (solo visible en movil)
};

export function NoteEditor({ note, onChange, onDelete, onBack }: Props) {
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // Solo aplica en movil: si el panel de keywords esta abierto. En desktop
  // el panel se muestra siempre (lo decide el CSS), independiente de esto.
  const [showKeywords, setShowKeywords] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuando cambia la nota seleccionada, sincronizamos los campos locales y
  // reseteamos confirmacion de borrado, indicador de guardado y panel.
  useEffect(() => {
    setTitle(note?.title ?? "");
    setKeywords(note?.keywords ?? "");
    setConfirmDelete(false);
    setSaveStatus("idle");
    setShowKeywords(false);
  }, [note?.id]);

  // Guarda de verdad: marca "Guardando...", espera al server y marca "Guardado".
  async function commitSave(id: string, changes: NoteUpdate) {
    setSaveStatus("saving");
    await onChange(id, changes);
    setSaveStatus("saved");
  }

  // Programa el guardado diferido (debounce). Desde que tipeas ya se ve
  // "Guardando..." y recien tras 600ms sin teclear se manda al server.
  function scheduleSave(changes: NoteUpdate) {
    if (!note) return;
    setSaveStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    const id = note.id;
    timer.current = setTimeout(() => void commitSave(id, changes), 600);
  }

  // Exportar la nota activa como .txt (convierte el HTML a texto plano).
  function handleExport() {
    if (!note) return;
    const cuerpo =
      new DOMParser().parseFromString(note.content, "text/html").body
        .textContent ?? "";
    const texto = `${note.title}\n\n${cuerpo}`.trim() + "\n";
    const nombre = (note.title.trim() || "nota").replace(/[\\/:*?"<>|]/g, "_");
    const url = URL.createObjectURL(
      new Blob([texto], { type: "text/plain;charset=utf-8" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nombre}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

        {/* Centro: estado de guardado */}
        {saveStatus === "saving" && (
          <span className={styles.saveStatus}>Guardando…</span>
        )}
        {saveStatus === "saved" && (
          <span className={styles.saveStatus}>Guardado ✓</span>
        )}

        {/* Derecha: acciones de la nota */}
        <div className={styles.actions}>
          <Button
            variant="ghost"
            className={styles.keywordsToggle}
            onClick={() => setShowKeywords((v) => !v)}
          >
            {showKeywords ? "✕ Keywords" : "Keywords"}
          </Button>
          <Button variant="ghost" onClick={() => setShowHelp(true)}>Atajos</Button>
          <Button
            variant="ghost"
            onClick={() => void commitSave(note.id, { pinned: !note.pinned })}
          >
            {note.pinned ? "📌 Quitar" : "📌 Fijar"}
          </Button>
          <Button variant="ghost" onClick={handleExport}>Exportar</Button>
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

      <div className={`${styles.body} ${showKeywords ? styles.withKeywords : ""}`}>
        <div className={styles.main}>
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

        {/* Panel de keywords: aclaraciones/definiciones atadas a la nota.
            En desktop va a la derecha siempre; en movil se abre con el
            boton "Keywords" de la toolbar. */}
        <aside className={styles.keywords}>
          <div className={styles.keywordsHeader}>Keywords</div>
          <textarea
            className={styles.keywordsInput}
            value={keywords}
            placeholder="Términos, definiciones, aclaraciones de conceptos…"
            onChange={(e) => {
              setKeywords(e.target.value);
              scheduleSave({ keywords: e.target.value });
            }}
          />
        </aside>
      </div>

      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
    </main>
  );
}
