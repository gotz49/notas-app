// ============================================================
//  Bloque "Desplegable": una pastilla con opciones a elegir
//  (Pendiente / En curso / Listo por defecto). Las opciones se
//  agregan y quitan desde el mismo menu. En el HTML queda como:
//    <span data-type="dropdown" data-value="Listo"
//          data-options='["Pendiente","En curso","Listo"]'>Listo</span>
// ============================================================
import { Node, mergeAttributes, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { Icon } from "./icons";
import { usePopoverClose } from "./usePopoverClose";
import styles from "./chips.module.css";

const DEFAULT_OPTIONS = ["Opción 1", "Opción 2", "Opción 3"];

function parseOptions(raw: string | null): string[] {
  if (!raw) return DEFAULT_OPTIONS;
  try {
    const arr: unknown = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
  } catch {
    /* formato invalido: usamos las opciones por defecto */
  }
  return DEFAULT_OPTIONS;
}

function DropdownView({ node, updateAttributes, editor }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef<HTMLSpanElement>(null);
  const close = useCallback(() => setOpen(false), []);
  usePopoverClose(ref, open, close);

  const options = node.attrs.options as string[];
  const value = node.attrs.value as string;

  function select(opt: string) {
    updateAttributes({ value: opt });
    setOpen(false);
  }

  function addOption() {
    const opt = draft.trim();
    if (!opt || options.includes(opt)) return;
    updateAttributes({ options: [...options, opt], value: value || opt });
    setDraft("");
  }

  function removeOption(opt: string) {
    const next = options.filter((o) => o !== opt);
    updateAttributes({ options: next, value: value === opt ? (next[0] ?? "") : value });
  }

  return (
    <NodeViewWrapper as="span" className={styles.wrapper}>
      <span ref={ref} className={styles.wrap} contentEditable={false}>
        <button
          type="button"
          className={`${styles.chip} ${styles.dropdownChip}`}
          onClick={() => editor.isEditable && setOpen((o) => !o)}
        >
          {value || "Elegir…"}
          <Icon name="chevron" size={14} />
        </button>
        {open && (
          <span className={`${styles.popover} ${styles.menu}`}>
            {options.map((opt) => (
              <span key={opt} className={styles.option}>
                <button
                  type="button"
                  className={`${styles.optionBtn} ${opt === value ? styles.optionActive : ""}`}
                  onClick={() => select(opt)}
                >
                  {opt}
                </button>
                <button
                  type="button"
                  className={styles.removeBtn}
                  title="Quitar opción"
                  aria-label={`Quitar ${opt}`}
                  onClick={() => removeOption(opt)}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className={styles.input}
              placeholder="Agregar opción y Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOption();
                }
              }}
            />
          </span>
        )}
      </span>
    </NodeViewWrapper>
  );
}

export const DropdownChip = Node.create({
  name: "dropdownChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      options: {
        default: DEFAULT_OPTIONS,
        parseHTML: (el: HTMLElement) => parseOptions(el.getAttribute("data-options")),
        renderHTML: (attrs: { options: string[] }) => ({ "data-options": JSON.stringify(attrs.options) }),
      },
      value: {
        default: "",
        parseHTML: (el: HTMLElement) => el.getAttribute("data-value") ?? "",
        renderHTML: (attrs: { value: string }) => ({ "data-value": attrs.value }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="dropdown"]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-type": "dropdown" }), node.attrs.value || "—"];
  },

  renderText({ node }) {
    return node.attrs.value;
  },

  addNodeView() {
    return ReactNodeViewRenderer(DropdownView);
  },
});
