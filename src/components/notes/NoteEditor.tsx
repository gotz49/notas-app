// ============================================================
//  NoteEditor
// ------------------------------------------------------------
//  Panel principal: titulo + cuerpo en un editor enriquecido
//  (una sola superficie, sin pestanas). El formato se aplica en
//  vivo mientras escribis.
//
//  Guarda con "debounce": espera ~600ms despues de que dejas de
//  teclear antes de mandar a la base, para no escribir en cada letra.
//
//  Las acciones de la nota (Keywords, Atajos, Fijar, Exportar,
//  Borrar) viven en un menu hamburguesa para no recargar la barra
//  (sobre todo en movil). El mismo menu se ofrece con clic derecho
//  desde la lista (ver NoteActionsMenu).
// ============================================================
import { useEffect, useRef, useState } from "react";
import type { Note, NoteUpdate } from "../../types";
import { Button } from "../ui/Button";
import { Editor, type EditorHandle } from "./Editor";
import { GastosEditor } from "./GastosEditor";
import { PesoEditor } from "./PesoEditor";
import { NoteActionsMenu } from "./NoteActionsMenu";
import styles from "./NoteEditor.module.css";

// Estado del indicador de guardado que se muestra en la toolbar.
type SaveStatus = "idle" | "saving" | "saved";

type Props = {
  note: Note | null;
  onChange: (id: string, changes: NoteUpdate) => void | Promise<unknown>;
  onDelete: (id: string) => void;
  onBack?: () => void; // volver a la lista (solo visible en movil)
  // Visibilidad del panel de keywords (la maneja App, que tambien la abre
  // desde el clic derecho de la lista) y disparador del panel de atajos.
  showKeywords: boolean;
  onToggleKeywords: () => void;
  onShowHelp: () => void;
  onExport: (note: Note) => void; // lo maneja App (nota/gastos: descarga; peso: dialogo)
  onUploadImage: (file: File) => Promise<string>; // sube imagen -> URL publica
};

export function NoteEditor({
  note,
  onChange,
  onDelete,
  onBack,
  showKeywords,
  onToggleKeywords,
  onShowHelp,
  onExport,
  onUploadImage,
}: Props) {
  const [title, setTitle] = useState("");
  const [keywords, setKeywords] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [menuOpen, setMenuOpen] = useState(false); // menu hamburguesa de acciones
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref al editor de texto para abrir el menu de formato desde el boton "Aa"
  // de la barra (asi el long-press queda libre para la seleccion nativa).
  const editorRef = useRef<EditorHandle>(null);

  // Cuando cambia la nota seleccionada, sincronizamos los campos locales y
  // reseteamos el indicador de guardado y el menu de acciones.
  useEffect(() => {
    setTitle(note?.title ?? "");
    setKeywords(note?.keywords ?? "");
    setSaveStatus("idle");
    setMenuOpen(false);
  }, [note?.id]);

  // El "Guardado ✓" es efimero: se muestra un instante y desaparece, sin
  // quedarse fijo en la barra.
  useEffect(() => {
    if (saveStatus !== "saved") return;
    const t = setTimeout(() => setSaveStatus("idle"), 800);
    return () => clearTimeout(t);
  }, [saveStatus]);

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

  // Sin nota seleccionada: pantalla de inicio (tambien al apretar Esc en una
  // nota abierta, ver App). Mensaje breve y en gris sutil.
  if (!note) {
    return (
      <main className={styles.editor}>
        <div className={styles.home}>
          <p className={styles.homeText}>
            Seleccioná una nota o creá una nueva para visualizarla.
          </p>
        </div>
      </main>
    );
  }

  // Cada tipo usa su editor. Solo la nota de texto ("nota") tiene panel de
  // keywords e imagenes; gastos y peso no.
  const esGastos = note.kind === "gastos";
  const esPeso = note.kind === "peso";
  const esTexto = note.kind === "nota";
  const placeholderTitulo = esGastos ? "Gastos" : esPeso ? "Peso" : "Sin titulo";

  return (
    <main className={styles.editor}>
      <div className={styles.toolbar}>
        {/* Izquierda: volver a la lista (solo en movil, via .backBtn) */}
        <Button variant="ghost" className={styles.backBtn} onClick={onBack}>← Notas</Button>

        {/* Centro: estado de guardado */}
        <span className={styles.saveSlot}>
          {saveStatus === "saving" && (
            <span className={styles.saveStatus}>Guardando…</span>
          )}
          {saveStatus === "saved" && (
            <span className={`${styles.saveStatus} ${styles.saved}`}>Guardado ✓</span>
          )}
        </span>

        {/* Boton de formato: abre el menu sobre la seleccion. Solo en notas de
            texto (gastos/peso no tienen formato). En movil deja el long-press
            libre para la seleccion nativa. */}
        {esTexto && (
          <Button
            variant="ghost"
            className={styles.formatBtn}
            aria-label="Formato de texto"
            onClick={() => editorRef.current?.openFormatMenu()}
          >
            Aa
          </Button>
        )}

        {/* Derecha: menu hamburguesa con todas las acciones de la nota */}
        <div className={styles.menuWrap}>
          <Button
            variant="ghost"
            className={styles.menuBtn}
            aria-label="Opciones de la nota"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            ☰
          </Button>
          {menuOpen && (
            <NoteActionsMenu
              note={note}
              style={{ position: "absolute", top: "calc(100% + 6px)", right: 0 }}
              showKeywordsItem={esTexto}
              keywordsLabel={showKeywords ? "Ocultar keywords" : "Keywords"}
              onKeywords={onToggleKeywords}
              onHelp={onShowHelp}
              onTogglePin={() => void commitSave(note.id, { pinned: !note.pinned })}
              onExport={() => onExport(note)}
              onDelete={() => onDelete(note.id)}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </div>
      </div>

      <div className={`${styles.body} ${showKeywords && esTexto ? styles.withKeywords : ""}`}>
        <div className={styles.main}>
          <div className={styles.inner}>
            <input
              className={styles.titleInput}
              value={title}
              placeholder={placeholderTitulo}
              onChange={(e) => {
                setTitle(e.target.value);
                scheduleSave({ title: e.target.value });
              }}
            />
            {/* key={note.id}: al cambiar de nota, el editor se reinicia
                limpio con el contenido de la nota nueva. */}
            {esGastos ? (
              <GastosEditor
                key={note.id}
                content={note.content}
                onChange={(json) => scheduleSave({ content: json })}
              />
            ) : esPeso ? (
              <PesoEditor
                key={note.id}
                content={note.content}
                onChange={(json) => scheduleSave({ content: json })}
              />
            ) : (
              <Editor
                key={note.id}
                ref={editorRef}
                content={note.content}
                onChange={(html) => scheduleSave({ content: html })}
                onUploadImage={onUploadImage}
              />
            )}
          </div>
        </div>

        {/* Panel de keywords: aclaraciones/definiciones atadas a la nota.
            En desktop va a la derecha siempre; en movil se abre con la
            opcion "Keywords" del menu de acciones. Solo en notas de texto. */}
        {esTexto && (
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
        )}
      </div>
    </main>
  );
}
