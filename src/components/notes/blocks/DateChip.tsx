// ============================================================
//  Bloque "Fecha": una pastilla con calendario dentro del texto.
//  En el HTML de la nota queda como:
//    <span data-type="date" data-value="2026-11-04">4 nov 2026</span>
//  (el texto visible tambien se guarda, asi el export .txt lo muestra).
// ============================================================
import { Node, mergeAttributes, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { Icon } from "./icons";
import { todayISO } from "./blocks";
import { usePopoverClose } from "./usePopoverClose";
import styles from "./chips.module.css";

export function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function DateView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  usePopoverClose(ref, open, close);
  const value = node.attrs.value as string;

  return (
    <NodeViewWrapper as="span" className={styles.wrapper}>
      <span ref={ref} className={styles.wrap} contentEditable={false}>
        <button
          type="button"
          className={styles.chip}
          onClick={() => editor.isEditable && setOpen((o) => !o)}
        >
          <Icon name="date" size={14} />
          {formatDate(value)}
        </button>
        {open && (
          <span className={styles.popover}>
            <input
              type="date"
              className={styles.input}
              value={value}
              autoFocus
              onChange={(e) => e.target.value && updateAttributes({ value: e.target.value })}
            />
            <button
              type="button"
              className={styles.smallBtn}
              onClick={() => updateAttributes({ value: todayISO() })}
            >
              Hoy
            </button>
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const DateChip = Node.create({
  name: "dateChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      value: {
        default: todayISO(),
        parseHTML: (el: HTMLElement) => el.getAttribute("data-value") || todayISO(),
        renderHTML: (attrs: { value: string }) => ({ "data-value": attrs.value }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="date"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "date" }), formatDate(node.attrs.value)];
  },

  renderText({ node }) {
    return formatDate(node.attrs.value);
  },

  addNodeView() {
    return ReactNodeViewRenderer(DateView);
  },
});
