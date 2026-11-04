// ============================================================
//  Comando "/" : al escribir "/" en el documento se abre un menu
//  con los bloques, que se filtra mientras escribis ("/tab" ->
//  Tabla). Esta extension solo detecta el "/" y avisa a React;
//  el menu visual lo dibuja <SlashMenu />.
// ============================================================
import { Extension, type Editor, type Range } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion from "@tiptap/suggestion";
import { filterBlocks, type BlockContext, type BlockDef } from "./blocks";

export const slashPluginKey = new PluginKey("slashCommand");

export type SlashState = {
  items: BlockDef[];
  rect: DOMRect | null;
  command: (item: BlockDef) => void;
} | null;

export type SlashKeyHandler = (event: KeyboardEvent) => boolean;

type Options = {
  // Funciones (no objetos/refs): TipTap copia en profundidad los objetos
  // de las opciones, y un ref copiado dejaria de apuntar al de React.
  onState: (state: SlashState) => void;
  getKeyHandler: () => SlashKeyHandler | null;
  getContext: () => BlockContext;
};

export const SlashCommand = Extension.create<Options>({
  name: "slashCommand",

  addOptions() {
    return { onState: () => {}, getKeyHandler: () => null, getContext: () => ({}) };
  },

  addProseMirrorPlugins() {
    const { onState, getKeyHandler, getContext } = this.options;
    return [
      Suggestion<BlockDef, BlockDef>({
        editor: this.editor,
        pluginKey: slashPluginKey,
        char: "/",
        allowSpaces: false,
        items: ({ query }) => filterBlocks(query, getContext()),
        command: ({ editor, range, props }: { editor: Editor; range: Range; props: BlockDef }) =>
          props.run(editor, range, getContext()),
        render: () => ({
          onStart: (p) => onState({ items: p.items, rect: p.clientRect?.() ?? null, command: p.command }),
          onUpdate: (p) => onState({ items: p.items, rect: p.clientRect?.() ?? null, command: p.command }),
          onKeyDown: ({ event }) => getKeyHandler()?.(event) ?? false,
          onExit: () => onState(null),
        }),
      }),
    ];
  },
});
