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
//  TipTap genera HTML estandar (h1, ul, blockquote...). Por eso el
//  contenido se guarda como HTML.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor as TipTapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import styles from "./Editor.module.css";

type Props = {
  content: string;
  onChange: (html: string) => void;
};

// Posicion del menu contextual (o null si esta cerrado)
type MenuPos = { x: number; y: number } | null;

export function Editor({ content, onChange }: Props) {
  const [menu, setMenu] = useState<MenuPos>(null);

  const editor = useEditor({
    extensions: [StarterKit], // incluye negrita, titulos, listas, cita, codigo, divisor...
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

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
      {menu && <ContextMenu editor={editor} pos={menu} />}
    </div>
  );
}

// ---- Menu contextual (clic derecho) -------------------------
function ContextMenu({ editor, pos }: { editor: TipTapEditor; pos: { x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);

  // Cada item ejecuta un comando de TipTap sobre la seleccion actual.
  const run = (fn: () => void) => () => {
    fn();
    editor.chain().focus().run();
  };

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ top: pos.y, left: pos.x }}
      // Evita que el clic dentro del menu lo cierre antes de actuar
      onClick={(e) => e.stopPropagation()}
    >
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
      <div className={styles.sep} />
      <MenuItem label="Limpiar formato" onClick={run(() => editor.chain().focus().unsetAllMarks().clearNodes().run())} />
    </div>
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
