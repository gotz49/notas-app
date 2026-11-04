// ============================================================
//  Catalogo de bloques insertables (estilo Claude Docs)
// ------------------------------------------------------------
//  Una sola lista que usan el boton "+" de la barra y el comando
//  "/" dentro del documento. Si agregas un bloque aca, aparece en
//  los dos lugares.
// ============================================================
import type { Editor, Range } from "@tiptap/react";
import type { IconName } from "./icons";

// Lo que un bloque puede necesitar del editor que lo contiene.
export type BlockContext = {
  // Abre el selector de archivos para subir una imagen (si hay Storage).
  pickImage?: () => void;
};

export type BlockDef = {
  id: string;
  label: string;
  icon: IconName;
  keywords: string[];
  // true = aparece en el menu "+"; false = solo buscandolo con "/".
  inPlusMenu: boolean;
  // Si devuelve false, el bloque no se ofrece (p. ej. imagen sin Storage).
  available?: (ctx: BlockContext) => boolean;
  run: (editor: Editor, range: Range | undefined, ctx: BlockContext) => void;
};

// Arranca la cadena de comandos; si vino desde "/", borra el "/consulta".
function start(editor: Editor, range?: Range) {
  const chain = editor.chain().focus();
  return range ? chain.deleteRange(range) : chain;
}

// Fecha de hoy en formato 'YYYY-MM-DD' (hora local, sin zona horaria).
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const BLOCKS: BlockDef[] = [
  {
    id: "bullet",
    label: "Lista con viñetas",
    icon: "bullet",
    keywords: ["bulleted", "lista", "viñetas", "vinetas", "ul"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).toggleBulletList().run(),
  },
  {
    id: "checklist",
    label: "Checklist",
    icon: "check",
    keywords: ["checklist", "tareas", "todo", "check"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).toggleTaskList().run(),
  },
  {
    id: "code",
    label: "Bloque de código",
    icon: "code",
    keywords: ["code", "codigo", "código", "pre"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).toggleCodeBlock().run(),
  },
  {
    id: "date",
    label: "Fecha",
    icon: "date",
    keywords: ["date", "fecha", "dia", "día", "hoy"],
    inPlusMenu: true,
    run: (e, r) =>
      start(e, r)
        .insertContent([{ type: "dateChip", attrs: { value: todayISO() } }, { type: "text", text: " " }])
        .run(),
  },
  {
    id: "divider",
    label: "Divisor",
    icon: "divider",
    keywords: ["divider", "divisor", "separador", "linea", "línea", "hr"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).setHorizontalRule().run(),
  },
  {
    id: "dropdown",
    label: "Desplegable",
    icon: "dropdown",
    keywords: ["dropdown", "desplegable", "select", "estado", "opciones"],
    inPlusMenu: true,
    run: (e, r) =>
      start(e, r)
        .insertContent([
          { type: "dropdownChip", attrs: { options: ["Pendiente", "En curso", "Listo"], value: "Pendiente" } },
          { type: "text", text: " " },
        ])
        .run(),
  },
  {
    id: "h1",
    label: "Título 1",
    icon: "h1",
    keywords: ["heading", "titulo", "título", "h1"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).setHeading({ level: 1 }).run(),
  },
  {
    id: "h2",
    label: "Título 2",
    icon: "h2",
    keywords: ["heading", "titulo", "título", "subtitulo", "h2"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).setHeading({ level: 2 }).run(),
  },
  {
    id: "h3",
    label: "Título 3",
    icon: "h3",
    keywords: ["heading", "titulo", "título", "h3"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).setHeading({ level: 3 }).run(),
  },
  {
    id: "numbered",
    label: "Lista numerada",
    icon: "numbered",
    keywords: ["numbered", "numerada", "ol", "lista"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).toggleOrderedList().run(),
  },
  {
    id: "quote",
    label: "Cita",
    icon: "quote",
    keywords: ["quote", "cita", "blockquote"],
    inPlusMenu: true,
    run: (e, r) => start(e, r).toggleBlockquote().run(),
  },
  // --- Solo con "/" (el "Type / for more" de Claude Docs) ---
  {
    id: "text",
    label: "Texto",
    icon: "text",
    keywords: ["text", "texto", "parrafo", "párrafo", "normal"],
    inPlusMenu: false,
    run: (e, r) => start(e, r).setParagraph().run(),
  },
  {
    id: "table",
    label: "Tabla",
    icon: "table",
    keywords: ["table", "tabla", "grilla"],
    inPlusMenu: false,
    run: (e, r) => start(e, r).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    id: "image",
    label: "Imagen",
    icon: "image",
    keywords: ["image", "imagen", "foto", "img"],
    inPlusMenu: false,
    available: (ctx) => !!ctx.pickImage,
    run: (e, r, ctx) => {
      if (r) e.chain().focus().deleteRange(r).run();
      ctx.pickImage?.();
    },
  },
];

// Bloques del menu "+" (en el orden del catalogo).
export function plusBlocks(ctx: BlockContext): BlockDef[] {
  return BLOCKS.filter((b) => b.inPlusMenu && (b.available?.(ctx) ?? true));
}

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Bloques que coinciden con lo tipeado despues del "/".
export function filterBlocks(query: string, ctx: BlockContext): BlockDef[] {
  const q = normalize(query.trim());
  const disponibles = BLOCKS.filter((b) => b.available?.(ctx) ?? true);
  if (!q) return disponibles;
  return disponibles.filter(
    (b) => normalize(b.label).includes(q) || b.keywords.some((k) => normalize(k).startsWith(q))
  );
}
