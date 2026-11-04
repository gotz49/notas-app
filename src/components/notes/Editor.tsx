// ============================================================
//  Editor  (editor enriquecido / WYSIWYG, basado en TipTap)
// ------------------------------------------------------------
//  Una sola superficie para escribir, como un bloc de notas, pero
//  el formato se ve aplicado en vivo. Tres formas de dar formato:
//   1) Markdown mientras escribis: "# " -> titulo, "- " -> lista,
//      "**texto**" -> negrita, "---" -> divisor, etc. (auto).
//   2) Atajos de teclado (ver panel "Atajos").
//   3) Clic derecho -> menu de formatos.
//
//   4) Bloques estilo Claude Docs: boton "+" de la barra o escribir
//      "/" en el documento (checklist, tabla, fecha, desplegable...).
//      El catalogo vive en blocks/blocks.ts.
//
//  Imagenes: se pueden pegar, arrastrar o elegir desde el menu. No
//  van en la base: se suben a Storage (onUploadImage) y en el HTML
//  queda solo un <img src="url">. Por eso el contenido se guarda
//  como HTML.
// ============================================================
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useEditor, EditorContent, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { exitSuggestion } from "@tiptap/suggestion";
import { plusBlocks, type BlockContext } from "./blocks/blocks";
import { BlockMenu } from "./blocks/BlockMenu";
import { DateChip } from "./blocks/DateChip";
import { DropdownChip } from "./blocks/DropdownChip";
import { SlashCommand, slashPluginKey, type SlashKeyHandler, type SlashState } from "./blocks/SlashCommand";
import { SlashMenu } from "./blocks/SlashMenu";
import blockStyles from "./blocks/BlockMenu.module.css";
import styles from "./Editor.module.css";

type Props = {
  content: string;
  onChange: (html: string) => void;
  // Sube una imagen y devuelve su URL publica. Si no se pasa, se desactiva
  // todo lo relacionado con imagenes (pegar, arrastrar y la opcion del menu).
  onUploadImage?: (file: File) => Promise<string>;
};

// Estado del menu contextual (o null si esta cerrado). `centered` = mostrarlo
// centrado en pantalla (cuando lo abre el boton "Aa" de la barra, no el cursor).
type MenuPos = { x: number; y: number; centered: boolean } | null;

// API imperativa que el editor expone al padre (NoteEditor) para abrir, desde
// la barra superior, el menu de formato ("Aa") y el de bloques ("+", que se
// abre debajo del boton que se le pasa).
export type EditorHandle = {
  openFormatMenu: () => void;
  openInsertMenu: (anchor: DOMRect) => void;
};

// De un DataTransfer/Clipboard, devuelve solo los archivos de imagen.
function imageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  { content, onChange, onUploadImage },
  ref
) {
  const [menu, setMenu] = useState<MenuPos>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Funcion "subir + insertar". Vive en un ref porque los handlers de
  // pegar/soltar de TipTap se crean una sola vez (al iniciar el editor) y
  // necesitan la version actual con el editor ya montado y onUploadImage.
  const insertImages = useRef<(files: File[]) => void>(() => {});

  // Menu "/" (lo detecta SlashCommand y lo dibuja SlashMenu) y menu "+".
  const [slash, setSlash] = useState<SlashState>(null);
  const slashKeys = useRef<SlashKeyHandler | null>(null);
  const [insertAnchor, setInsertAnchor] = useState<DOMRect | null>(null);
  // Lo que los bloques necesitan del editor (p. ej. abrir el selector de
  // imagen). En un ref porque las extensiones se crean una sola vez.
  const blockCtx = useRef<BlockContext>({});
  blockCtx.current = onUploadImage ? { pickImage: () => fileInput.current?.click() } : {};

  const editor = useEditor({
    extensions: [
      StarterKit, // negrita, titulos, listas, cita, divisor, codigo...
      Image,
      TaskList, // checklist
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: false } }),
      DateChip,
      DropdownChip,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === "heading" ? `Título ${node.attrs.level}` : "Escribí, o usá / para insertar un bloque…",
      }),
      SlashCommand.configure({
        onState: setSlash,
        getKeyHandler: () => slashKeys.current,
        getContext: () => blockCtx.current,
      }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      // Pegar una imagen: la subimos e insertamos en vez del comportamiento
      // por defecto (que la incrustaria como base64 y engordaria la nota).
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData);
        if (files.length === 0) return false;
        insertImages.current(files);
        return true;
      },
      // Arrastrar y soltar una imagen sobre el editor.
      handleDrop: (_view, event) => {
        const files = imageFiles((event as DragEvent).dataTransfer);
        if (files.length === 0) return false;
        event.preventDefault();
        insertImages.current(files);
        return true;
      },
    },
  });

  // Mantener insertImages apuntando a una funcion con el editor y el uploader
  // actuales. Sube cada archivo (en orden) y lo inserta al terminar.
  useEffect(() => {
    insertImages.current = async (files: File[]) => {
      if (!editor || !onUploadImage) return;
      for (const file of files) {
        try {
          const url = await onUploadImage(file);
          editor.chain().focus().setImage({ src: url }).run();
        } catch {
          alert("No se pudo subir la imagen.");
        }
      }
    };
  }, [editor, onUploadImage]);

  // Cerrar el menu al hacer clic en cualquier lado o con Escape. El Escape se
  // escucha en fase de captura y detiene la propagacion para que solo cierre
  // este menu y no dispare ademas el "volver al inicio" global de App.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMenu(null);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [menu]);

  // El padre (NoteEditor) abre el menu de formato desde el boton "Aa" de la
  // barra: se muestra centrado y actua sobre la seleccion actual del editor.
  // Antes de abrir, cerramos el popup NATIVO de seleccion de Android quitando
  // el foco y la seleccion del DOM. ProseMirror conserva su seleccion en su
  // estado, asi que al elegir un formato (que hace focus()) se aplica igual; y
  // "Copiar" lee la seleccion del estado, no del DOM, asi que tambien funciona.
  useImperativeHandle(ref, () => ({
    openFormatMenu: () => {
      editor?.commands.blur();
      window.getSelection()?.removeAllRanges();
      setMenu({ x: 0, y: 0, centered: true });
    },
    openInsertMenu: (anchor: DOMRect) => {
      setMenu(null);
      setInsertAnchor(anchor);
    },
  }), [editor]);

  // Menu "/" abierto: Escape lo cierra sin salir de la nota (captura +
  // stopPropagation, igual que el menu de formato).
  useEffect(() => {
    if (!slash || !editor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      exitSuggestion(editor.view, slashPluginKey);
      setSlash(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [slash, editor]);

  // Menu "+" abierto: se cierra con clic afuera o Escape.
  useEffect(() => {
    if (!insertAnchor) return;
    const close = () => setInsertAnchor(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setInsertAnchor(null);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [insertAnchor]);

  if (!editor) return null;

  function openMenu(e: React.MouseEvent) {
    // En movil dejamos el long-press NATIVO (seleccionar texto + copiar/pegar
    // del sistema); el menu de formato se abre con el boton "Aa" de la barra.
    if (!window.matchMedia("(min-width: 769px)").matches) return;
    e.preventDefault(); // en desktop, reemplaza el menu nativo del navegador
    setMenu({ x: e.clientX, y: e.clientY, centered: false });
  }

  return (
    <div className={styles.editor} onContextMenu={openMenu}>
      <EditorContent editor={editor} />
      {menu && (
        <ContextMenu
          editor={editor}
          pos={menu}
          onImage={onUploadImage ? () => fileInput.current?.click() : undefined}
          onClose={() => setMenu(null)}
        />
      )}
      {slash && <SlashMenu state={slash} keyHandler={slashKeys} />}
      {insertAnchor && (
        <InsertMenu
          anchor={insertAnchor}
          ctx={blockCtx.current}
          onPick={(item) => {
            setInsertAnchor(null);
            item.run(editor, undefined, blockCtx.current);
          }}
          onClose={() => setInsertAnchor(null)}
        />
      )}
      {/* Selector de archivo oculto, disparado por la opcion "Insertar imagen". */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) insertImages.current(files);
          e.target.value = ""; // permite volver a elegir el mismo archivo
        }}
      />
    </div>
  );
});

// ---- Menu contextual (clic derecho) -------------------------
function ContextMenu({
  editor,
  pos,
  onImage,
  onClose,
}: {
  editor: TipTapEditor;
  pos: { x: number; y: number; centered: boolean };
  onImage?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // El menu va centrado en pantalla (con fondo atenuado) cuando lo abre el boton
  // "Aa" de la barra, y SIEMPRE en movil. En desktop con clic derecho sigue
  // junto al cursor, pero reubicado para que entre: si se saldria por el borde
  // derecho/inferior lo corremos hacia adentro (y si no entra en alto, scrollea).
  const isMobile = !window.matchMedia("(min-width: 769px)").matches;
  const useCentered = isMobile || pos.centered;
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (useCentered) return; // centrado: no hace falta medir
    const el = ref.current;
    if (!el) return;
    const margen = 8;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = pos.x;
    let top = pos.y;
    if (left + width + margen > vw) left = vw - width - margen;
    if (left < margen) left = margen;
    if (top + height + margen > vh) top = vh - height - margen;
    if (top < margen) top = margen;
    setCoords({ left, top });
  }, [pos, useCentered]);

  // En el modo anclado, hasta tener la posicion corregida lo dibujamos oculto
  // en el punto del toque (asi se mide su tamano sin que se vea un salto).
  const style: CSSProperties = useCentered
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(320px, calc(100vw - 32px))" }
    : coords
      ? { left: coords.left, top: coords.top }
      : { left: pos.x, top: pos.y, visibility: "hidden" };

  // Cada item ejecuta un comando de TipTap sobre la seleccion actual.
  const run = (fn: () => void) => () => {
    fn();
    editor.chain().focus().run();
  };

  // Copiar/Pegar/Seleccionar todo: en Android el long-press abre este menu en
  // vez del nativo, asi que estas tres acciones replican lo que ahi faltaria.
  // (En PC se hacen con el teclado.) Usan la Clipboard API; corre en contexto
  // seguro (la PWA va por https), si no hay permiso fallan en silencio.
  const hasSelection = !editor.state.selection.empty;
  async function copySelection() {
    if (!hasSelection) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, "\n");
    try {
      await navigator.clipboard?.writeText(text);
    } catch { /* sin permiso de portapapeles */ }
  }
  async function pasteClipboard() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text) editor.chain().focus().insertContent(text).run();
    } catch { /* sin permiso o portapapeles vacio */ }
  }

  // Estas tres cierran el menu al terminar (a diferencia de los formatos, que
  // quedan abiertos para encadenar varios).
  const act = (fn: () => unknown) => () => {
    void fn();
    onClose();
  };

  return (
    <>
      {/* Fondo atenuado detras del menu centrado (tap afuera = cerrar). */}
      {useCentered && <div className={styles.backdrop} onClick={onClose} />}
      <div
        ref={ref}
        className={styles.menu}
        style={style}
        // Evita que el clic dentro del menu lo cierre antes de actuar
        onClick={(e) => e.stopPropagation()}
      >
      <div className={styles.actionsRow}>
        <button className={styles.actionBtn} onClick={act(copySelection)} disabled={!hasSelection}>Copiar</button>
        <button className={styles.actionBtn} onClick={act(pasteClipboard)}>Pegar</button>
        <button className={styles.actionBtn} onClick={act(() => editor.chain().focus().selectAll().run())}>Sel. todo</button>
      </div>
      <div className={styles.sep} />
      <MenuItem label="Negrita" hint="Cmd/Ctrl+B" onClick={run(() => editor.chain().focus().toggleBold().run())} active={editor.isActive("bold")} />
      <MenuItem label="Cursiva" hint="Cmd/Ctrl+I" onClick={run(() => editor.chain().focus().toggleItalic().run())} active={editor.isActive("italic")} />
      <MenuItem label="Tachado" onClick={run(() => editor.chain().focus().toggleStrike().run())} active={editor.isActive("strike")} />
      <div className={styles.sep} />
      <MenuItem label="Titulo 1" onClick={run(() => editor.chain().focus().toggleHeading({ level: 1 }).run())} active={editor.isActive("heading", { level: 1 })} />
      <MenuItem label="Titulo 2" onClick={run(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} active={editor.isActive("heading", { level: 2 })} />
      <MenuItem label="Titulo 3" onClick={run(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} active={editor.isActive("heading", { level: 3 })} />
      <div className={styles.sep} />
      <MenuItem label="Lista con vinetas" onClick={run(() => editor.chain().focus().toggleBulletList().run())} active={editor.isActive("bulletList")} />
      <MenuItem label="Lista numerada" onClick={run(() => editor.chain().focus().toggleOrderedList().run())} active={editor.isActive("orderedList")} />
      <MenuItem label="Checklist" onClick={run(() => editor.chain().focus().toggleTaskList().run())} active={editor.isActive("taskList")} />
      <MenuItem label="Cita"onClick={run(() => editor.chain().focus().toggleBlockquote().run())} active={editor.isActive("blockquote")} />
      <MenuItem label="Codigo" onClick={run(() => editor.chain().focus().toggleCode().run())} active={editor.isActive("code")} />
      <MenuItem label="Divisor" onClick={run(() => editor.chain().focus().setHorizontalRule().run())} />
      {onImage && (
        <>
          <div className={styles.sep} />
          <MenuItem label="Insertar imagen…" onClick={onImage} />
        </>
      )}
      {/* Con el cursor dentro de una tabla: editar filas/columnas. */}
      {editor.isActive("table") && (
        <>
          <div className={styles.sep} />
          <MenuItem label="Agregar fila" onClick={run(() => editor.chain().focus().addRowAfter().run())} />
          <MenuItem label="Agregar columna" onClick={run(() => editor.chain().focus().addColumnAfter().run())} />
          <MenuItem label="Borrar fila" onClick={run(() => editor.chain().focus().deleteRow().run())} />
          <MenuItem label="Borrar columna" onClick={run(() => editor.chain().focus().deleteColumn().run())} />
          <MenuItem label="Borrar tabla" onClick={act(() => editor.chain().focus().deleteTable().run())} />
        </>
      )}
      <div className={styles.sep} />
      <MenuItem label="Limpiar formato" onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())} />
      </div>
    </>
  );
}

// ---- Menu "+" (insertar bloque, como en Claude Docs) --------
// En desktop se abre debajo del boton "+" de la barra; en movil, centrado
// con fondo atenuado (igual que el menu de formato).
function InsertMenu({
  anchor,
  ctx,
  onPick,
  onClose,
}: {
  anchor: DOMRect;
  ctx: BlockContext;
  onPick: (item: ReturnType<typeof plusBlocks>[number]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const isMobile = !window.matchMedia("(min-width: 769px)").matches;
  const style: CSSProperties = isMobile
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
    : { top: anchor.bottom + 6, left: Math.max(8, Math.min(anchor.left, window.innerWidth - 240)) };

  return (
    <>
      {isMobile && <div className={blockStyles.backdrop} onClick={onClose} />}
      <div className={blockStyles.floating} style={style} onClick={(e) => e.stopPropagation()}>
        <BlockMenu
          items={plusBlocks(ctx)}
          selected={selected}
          onHover={setSelected}
          onPick={onPick}
          footer="Escribí / en el documento para más"
        />
      </div>
    </>
  );
}

function MenuItem({ label, hint, onClick, active }: { label: string; hint?: string; onClick: () => void; active?: boolean }) {
  return (
    <button className={`${styles.item} ${active ? styles.itemActive : ""}`} onClick={onClick}>
      <span>{label}</span>
      {hint && <span className={styles.hint}>{hint}</span>}
    </button>
  );
}
