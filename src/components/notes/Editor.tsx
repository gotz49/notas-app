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
//  Imagenes: se pueden pegar, arrastrar o elegir desde el menu. No
//  van en la base: se suben a Storage (onUploadImage) y en el HTML
//  queda solo un <img src="url">. Por eso el contenido se guarda
//  como HTML.
// ============================================================
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useEditor, EditorContent, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import styles from "./Editor.module.css";

type Props = {
  content: string;
  onChange: (html: string) => void;
  // Sube una imagen y devuelve su URL publica. Si no se pasa, se desactiva
  // todo lo relacionado con imagenes (pegar, arrastrar y la opcion del menu).
  onUploadImage?: (file: File) => Promise<string>;
};

// Posicion del menu contextual (o null si esta cerrado)
type MenuPos = { x: number; y: number } | null;

// De un DataTransfer/Clipboard, devuelve solo los archivos de imagen.
function imageFiles(dt: DataTransfer | null): File[] {
  if (!dt) return [];
  return Array.from(dt.files).filter((f) => f.type.startsWith("image/"));
}

export function Editor({ content, onChange, onUploadImage }: Props) {
  const [menu, setMenu] = useState<MenuPos>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Funcion "subir + insertar". Vive en un ref porque los handlers de
  // pegar/soltar de TipTap se crean una sola vez (al iniciar el editor) y
  // necesitan la version actual con el editor ya montado y onUploadImage.
  const insertImages = useRef<(files: File[]) => void>(() => {});

  const editor = useEditor({
    extensions: [StarterKit, Image], // negrita, titulos, listas, cita, divisor, imagen...
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

  if (!editor) return null;

  function openMenu(e: React.MouseEvent) {
    e.preventDefault(); // reemplaza el menu nativo del navegador
    setMenu({ x: e.clientX, y: e.clientY });
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
}

// ---- Menu contextual (clic derecho) -------------------------
function ContextMenu({
  editor,
  pos,
  onImage,
  onClose,
}: {
  editor: TipTapEditor;
  pos: { x: number; y: number };
  onImage?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // En movil el menu va SIEMPRE centrado en pantalla (con fondo atenuado), asi
  // se ve completo sin importar donde tocaste. En desktop sigue junto al cursor,
  // pero reubicado para que entre: si se saldria por el borde derecho/inferior
  // lo corremos hacia adentro (y si es mas alto que la pantalla, el CSS scrollea).
  const isMobile = !window.matchMedia("(min-width: 769px)").matches;
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (isMobile) return; // en movil va centrado, no hace falta medir
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
  }, [pos, isMobile]);

  // En desktop, hasta tener la posicion corregida lo dibujamos oculto en el
  // punto del toque (asi se puede medir su tamano sin que se vea un salto).
  const style: CSSProperties = isMobile
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
      {/* En movil, fondo atenuado detras del menu centrado (tap afuera = cerrar). */}
      {isMobile && <div className={styles.backdrop} onClick={onClose} />}
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
      <MenuItem label="Cita" onClick={run(() => editor.chain().focus().toggleBlockquote().run())} active={editor.isActive("blockquote")} />
      <MenuItem label="Codigo" onClick={run(() => editor.chain().focus().toggleCode().run())} active={editor.isActive("code")} />
      <MenuItem label="Divisor" onClick={run(() => editor.chain().focus().setHorizontalRule().run())} />
      {onImage && (
        <>
          <div className={styles.sep} />
          <MenuItem label="Insertar imagen…" onClick={onImage} />
        </>
      )}
      <div className={styles.sep} />
      <MenuItem label="Limpiar formato" onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())} />
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
