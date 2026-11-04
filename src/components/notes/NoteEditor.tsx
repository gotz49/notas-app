// ============================================================
//  NoteEditor
// ------------------------------------------------------------
//  Panel principal: titulo + cuerpo en un editor enriquecido
//  (una sola superficie, sin pestanas). El formato se aplica en
//  vivo mientras escribis.
//
//  Guardado: cada cambio (titulo, contenido, keywords) se le pasa a la
//  cola de autoguardado (hooks/useAutosave -> utils/autosaveQueue.ts),
//  que espera ~600ms sin teclear, guarda, reintenta si falla y detecta
//  conflictos con otros dispositivos. Este componente solo avisa los
//  cambios y muestra el estado.
//
//  Dos piezas:
//   - NoteEditor (contenedor): decide que mostrar alrededor de la nota
//     (avisos de papelera y de conflicto) y cuando "adoptar" una version
//     nueva que llego de otro dispositivo.
//   - NotePanel: la barra + titulo + editor + keywords de UNA nota. Se
//     monta de nuevo (key = "id:revision") al cambiar de nota o al
//     adoptar una version remota, asi arranca limpio con el contenido
//     correcto (y cada nota tiene su propio historial de deshacer).
//
//  Las acciones de la nota (Keywords, Atajos, Fijar, Exportar,
//  Borrar) viven en un menu hamburguesa para no recargar la barra
//  (sobre todo en movil). El mismo menu se ofrece con clic derecho
//  desde la lista (ver NoteActionsMenu).
// ============================================================
import { useEffect, useRef, useState } from "react";
import type { Note, NoteUpdate } from "../../types";
import type { Autosave } from "../../hooks/useAutosave";
import { isNewer } from "../../utils/notes";
import { Button } from "../ui/Button";
import { Editor, type EditorHandle } from "./Editor";
import { GastosEditor } from "./GastosEditor";
import { PesoEditor } from "./PesoEditor";
import { NoteActionsMenu } from "./NoteActionsMenu";
import styles from "./NoteEditor.module.css";

type Props = {
  note: Note | null;
  autosave: Autosave;
  onTitleDraft: (id: string, changes: NoteUpdate) => void; // titulo en vivo en la lista
  onRefreshNote: (id: string) => Promise<Note | null>;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
  onTogglePin: (note: Note) => void;
  onError: (error: unknown, fallback: string) => void;
  onBack?: () => void; // volver a la lista (solo visible en movil)
  // Visibilidad del panel de keywords (la maneja App, que tambien la abre
  // desde el clic derecho de la lista) y disparador del panel de atajos.
  showKeywords: boolean;
  onToggleKeywords: () => void;
  onShowHelp: () => void;
  onExport: (note: Note) => void; // lo maneja App (nota/gastos: descarga; peso: dialogo)
  onUploadImage: (file: File) => Promise<string>; // sube imagen -> URL publica
};

export function NoteEditor(props: Props) {
  const { note, autosave, onRefreshNote, onRestore, onDeleteForever, onError } = props;
  const { queue } = autosave;

  // Sube cada vez que adoptamos una version que llego del servidor: forma
  // parte del "key" de NotePanel para que se monte de nuevo con ese contenido.
  const [revision, setRevision] = useState(0);

  // Versiones: al abrir una nota, el autoguardado escribe "a partir de" su
  // updated_at. Si despues llega una version MAS NUEVA (otro dispositivo) y
  // aca no hay cambios sin guardar, se muestra. Si hay cambios sin guardar,
  // no se toca nada: al guardar, el servidor detecta el conflicto y aparece
  // el aviso de abajo. Detalle: docs/ARQUITECTURA.md -> "Conflictos".
  useEffect(() => {
    if (!note || queue.isBusy(note.id)) return;
    const base = queue.getBase(note.id);
    if (base === undefined) {
      queue.setBase(note.id, note.updated_at);
    } else if (isNewer(note.updated_at, base)) {
      queue.setBase(note.id, note.updated_at);
      setRevision((r) => r + 1);
    }
  }, [note, queue]);

  // Sin nota seleccionada: pantalla de inicio (tambien al apretar Esc en una
  // nota abierta, ver App). Mensaje breve y en gris sutil.
  if (!note) {
    return (
      <main className={styles.editor}>
        <div className={styles.home}>
          <p className={styles.homeText}>Seleccioná una nota o creá una nueva para visualizarla.</p>
        </div>
      </main>
    );
  }

  const noteId = note.id;
  const inTrash = note.deleted_at !== null;
  const inConflict = autosave.status === "conflict" && autosave.conflictNoteId === noteId;

  // "Usar la otra version": descartar lo mio y mostrar lo del servidor.
  async function keepTheirs() {
    try {
      queue.keepTheirs();
      const fresh = await onRefreshNote(noteId);
      if (fresh) queue.setBase(noteId, fresh.updated_at);
      setRevision((r) => r + 1);
    } catch (e) {
      onError(e, "No se pudo traer la otra versión.");
    }
  }

  return (
    <main className={styles.editor}>
      {inTrash && (
        <div className={styles.banner} role="status">
          <span>Esta nota está en la papelera. Para editarla, restaurala.</span>
          <span className={styles.bannerActions}>
            <Button variant="ghost" onClick={() => onRestore(noteId)}>
              Restaurar
            </Button>
            <Button variant="danger" onClick={() => onDeleteForever(noteId)}>
              Borrar para siempre
            </Button>
          </span>
        </div>
      )}

      {inConflict && (
        <div className={`${styles.banner} ${styles.bannerWarning}`} role="alert">
          <span>
            Esta nota se modificó en otro dispositivo mientras la editabas. Tus últimos cambios todavía no se
            guardaron.
          </span>
          <span className={styles.bannerActions}>
            <Button variant="ghost" onClick={() => void keepTheirs()}>
              Usar la otra versión
            </Button>
            <Button onClick={() => void queue.keepMine()}>Quedarme con la mía</Button>
          </span>
        </div>
      )}

      <NotePanel key={`${noteId}:${revision}`} {...props} note={note} readOnly={inTrash} />
    </main>
  );
}

// ---- Panel de UNA nota (barra + titulo + editor + keywords) ----------

type PanelProps = Omit<Props, "note"> & { note: Note; readOnly: boolean };

function NotePanel({
  note,
  readOnly,
  autosave,
  onTitleDraft,
  onTrash,
  onTogglePin,
  onBack,
  showKeywords,
  onToggleKeywords,
  onShowHelp,
  onExport,
  onUploadImage,
}: PanelProps) {
  // Estado local de los campos de texto. Arranca con lo de la nota; como el
  // panel se monta de nuevo por nota (key), no hace falta re-sincronizarlo.
  const [title, setTitle] = useState(note.title);
  const [keywords, setKeywords] = useState(note.keywords);
  const [menuOpen, setMenuOpen] = useState(false); // menu hamburguesa de acciones
  // Ref al editor de texto para abrir el menu de formato desde el boton "Aa"
  // de la barra (asi el long-press queda libre para la seleccion nativa).
  const editorRef = useRef<EditorHandle>(null);

  // Cada cambio va a la cola de autoguardado (ella decide cuando guardar).
  const save = (changes: NoteUpdate) => autosave.queue.queue(note.id, changes);

  // Cada tipo usa su editor. Solo la nota de texto ("nota") tiene panel de
  // keywords e imagenes; gastos y peso no.
  const esGastos = note.kind === "gastos";
  const esPeso = note.kind === "peso";
  const esTexto = note.kind === "nota";
  const placeholderTitulo = esGastos ? "Gastos" : esPeso ? "Peso" : "Sin titulo";
  const editable = !readOnly;

  return (
    <>
      <div className={styles.toolbar}>
        {/* Izquierda: volver a la lista (solo en movil, via .backBtn) */}
        <Button variant="ghost" className={styles.backBtn} onClick={onBack}>
          ← Notas
        </Button>

        {/* Centro: estado de guardado */}
        <span className={styles.saveSlot}>
          <SaveIndicator autosave={autosave} noteId={note.id} />
        </span>

        {/* Boton "+": insertar bloque (checklist, fecha, desplegable...),
            como en Claude Docs. Tambien se puede escribir "/" en el texto. */}
        {esTexto && editable && (
          <Button
            variant="ghost"
            className={styles.formatBtn}
            aria-label="Insertar bloque"
            title="Insertar bloque (o escribí / en el texto)"
            onClick={(e) => {
              e.stopPropagation(); // que el clic que lo abre no lo cierre
              editorRef.current?.openInsertMenu(e.currentTarget.getBoundingClientRect());
            }}
          >
            +
          </Button>
        )}

        {/* Boton de formato: abre el menu sobre la seleccion. Solo en notas de
            texto (gastos/peso no tienen formato). En movil deja el long-press
            libre para la seleccion nativa. */}
        {esTexto && editable && (
          <Button
            variant="ghost"
            className={styles.formatBtn}
            aria-label="Formato de texto"
            onClick={(e) => {
              e.stopPropagation(); // que el clic que lo abre no lo cierre
              editorRef.current?.openFormatMenu();
            }}
          >
            Aa
          </Button>
        )}

        {/* Derecha: menu hamburguesa con todas las acciones de la nota */}
        {editable && (
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
                onTogglePin={() => onTogglePin(note)}
                onExport={() => onExport(note)}
                onDelete={() => onTrash(note.id)}
                onClose={() => setMenuOpen(false)}
              />
            )}
          </div>
        )}
      </div>

      <div className={`${styles.body} ${showKeywords && esTexto ? styles.withKeywords : ""}`}>
        <div className={styles.main}>
          <div className={styles.inner}>
            <input
              className={styles.titleInput}
              value={title}
              placeholder={placeholderTitulo}
              aria-label="Título de la nota"
              maxLength={500} /* mismo limite que la base (notes_title_length) */
              readOnly={readOnly}
              onChange={(e) => {
                setTitle(e.target.value);
                save({ title: e.target.value });
                onTitleDraft(note.id, { title: e.target.value });
              }}
            />
            {/* El panel ya se monta de nuevo por nota (key en NoteEditor),
                asi cada editor arranca limpio con el contenido correcto.
                En la papelera, gastos y peso quedan deshabilitados
                (fieldset disabled) y el editor de texto en solo lectura. */}
            {esGastos ? (
              <fieldset className={styles.fieldset} disabled={readOnly}>
                <GastosEditor content={note.content} onChange={(json) => save({ content: json })} />
              </fieldset>
            ) : esPeso ? (
              <fieldset className={styles.fieldset} disabled={readOnly}>
                <PesoEditor content={note.content} onChange={(json) => save({ content: json })} />
              </fieldset>
            ) : (
              <Editor
                ref={editorRef}
                content={note.content}
                editable={editable}
                onChange={(html) => save({ content: html })}
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
              readOnly={readOnly}
              onChange={(e) => {
                setKeywords(e.target.value);
                save({ keywords: e.target.value });
              }}
            />
          </aside>
        )}
      </div>
    </>
  );
}

// ---- Estado del guardado (centro de la barra) ------------------------
//  "Guardando…" mientras hay cambios sin guardar; "Guardado ✓" un instante
//  al terminar (efimero, no queda fijo); si falla, el error + "Reintentar";
//  si hay un conflicto, lo indica (el aviso con las opciones esta arriba).

function SaveIndicator({ autosave, noteId }: { autosave: Autosave; noteId: string }) {
  const { status, error, conflictNoteId, queue } = autosave;
  const [savedVisible, setSavedVisible] = useState(false);

  useEffect(() => {
    if (status !== "saved") {
      setSavedVisible(false);
      return;
    }
    setSavedVisible(true);
    const t = setTimeout(() => setSavedVisible(false), 800);
    return () => clearTimeout(t);
  }, [status]);

  if (status === "error") {
    return (
      <span className={`${styles.saveStatus} ${styles.saveError}`} role="alert">
        {error}{" "}
        <button type="button" className={styles.retryBtn} onClick={() => void queue.retryNow()}>
          Reintentar
        </button>
      </span>
    );
  }
  if (status === "conflict") {
    return (
      <span className={`${styles.saveStatus} ${styles.saveError}`}>
        {conflictNoteId === noteId ? "Conflicto de versiones" : "Conflicto en otra nota"}
      </span>
    );
  }
  if (status === "pending" || status === "saving") {
    return <span className={styles.saveStatus}>Guardando…</span>;
  }
  if (savedVisible) {
    return <span className={`${styles.saveStatus} ${styles.saved}`}>Guardado ✓</span>;
  }
  return null;
}
