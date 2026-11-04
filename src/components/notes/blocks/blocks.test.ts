// Tests del editor de texto SIN React: verifican que las notas se GUARDAN
// y se LEEN igual (HTML -> editor -> HTML). Si algun dia se rompe un bloque
// propio (Fecha, Desplegable) o una actualizacion de TipTap cambia el
// formato, estos tests avisan antes de que se corrompan notas reales.
//
// Las extensiones son las mismas que usa components/notes/Editor.tsx.
// Si agregas una extension alla, agregala tambien en EXTENSIONS.
import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { DateChip } from "./DateChip";
import { DropdownChip } from "./DropdownChip";
import { BLOCKS, filterBlocks } from "./blocks";

// Sin la vista React de las pastillas (en los tests no se dibuja nada).
const sinVista = { addNodeView: () => null };
const EXTENSIONS = [
  StarterKit,
  Image,
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: false } }),
  DateChip.extend(sinVista),
  DropdownChip.extend(sinVista),
];

const editors: Editor[] = [];
function abrir(html: string) {
  const editor = new Editor({ extensions: EXTENSIONS, content: html });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

// Abre el HTML en el editor y devuelve lo que se guardaria.
const idaYVuelta = (html: string) => abrir(html).getHTML();

describe("Guardar y volver a abrir no cambia la nota", () => {
  const casos: Record<string, string> = {
    titulos: "<h1>Uno</h1><h2>Dos</h2><h3>Tres</h3>",
    formato: "<p>Texto <strong>negrita</strong>, <em>cursiva</em>, <s>tachado</s> y <code>codigo</code>.</p>",
    listas: "<ul><li><p>uno</p></li></ul><ol><li><p>primero</p></li></ol>",
    checklist: '<ul data-type="taskList"><li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>hecho</p></div></li></ul>',
    link: '<p>Mira <a target="_blank" rel="noopener noreferrer nofollow" href="https://ejemplo.com">esto</a></p>',
    imagen: '<img src="https://ejemplo.com/foto.webp">',
  };

  for (const [nombre, html] of Object.entries(casos)) {
    it(nombre, () => {
      const una = idaYVuelta(html);
      expect(idaYVuelta(una)).toBe(una); // estable: abrir/guardar N veces da lo mismo
    });
  }

  it("fecha: conserva el valor", () => {
    const html = '<p>Entrega: <span data-type="date" data-value="2026-11-04">4 nov 2026</span></p>';
    const guardado = idaYVuelta(html);
    expect(guardado).toContain('data-value="2026-11-04"');
    expect(idaYVuelta(guardado)).toBe(guardado);
  });

  it("desplegable: conserva valor y opciones, incluso con comillas y simbolos", () => {
    const opciones = ['Dice "hola"', "a < b & c", "Listo"];
    const attr = JSON.stringify(opciones).replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;");
    const html = `<p>Estado: <span data-type="dropdown" data-value="Listo" data-options='${attr}'>Listo</span></p>`;
    const editor = abrir(html);
    let attrs: { value?: string; options?: string[] } = {};
    editor.state.doc.descendants((node) => {
      if (node.type.name === "dropdownChip") attrs = node.attrs;
    });
    expect(attrs).toEqual({ value: "Listo", options: opciones });
    const guardado = editor.getHTML();
    expect(idaYVuelta(guardado)).toBe(guardado);
  });
});

describe("Seguridad del contenido", () => {
  it("descarta HTML peligroso guardado o pegado en una nota", () => {
    const html =
      '<p>hola</p><script>alert(1)</script><img src="x" onerror="alert(2)"><p><a href="javascript:alert(3)">click</a></p>';
    const guardado = idaYVuelta(html);
    expect(guardado).not.toContain("<script");
    expect(guardado).not.toContain("onerror");
    expect(guardado).not.toContain("javascript:");
  });
});

describe("Catalogo de bloques (menu + y /)", () => {
  it("cada bloque tiene id unico", () => {
    const ids = BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("el filtro del / encuentra por palabra clave", () => {
    expect(filterBlocks("tab", {}).map((b) => b.id)).toContain("table");
    expect(filterBlocks("zzzz", {})).toEqual([]);
  });
});
