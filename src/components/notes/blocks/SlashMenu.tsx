// Menu flotante que aparece debajo del cursor al escribir "/".
import { useEffect, useState, type MutableRefObject } from "react";
import type { SlashKeyHandler, SlashState } from "./SlashCommand";
import { BlockMenu } from "./BlockMenu";
import styles from "./BlockMenu.module.css";

type Props = {
  state: NonNullable<SlashState>;
  keyHandler: MutableRefObject<SlashKeyHandler | null>;
};

const MENU_W = 232;
const MENU_H = 360;

export function SlashMenu({ state, keyHandler }: Props) {
  const [selected, setSelected] = useState(0);
  const { items, rect, command } = state;

  // Al cambiar el filtro, volver al primer item.
  useEffect(() => setSelected(0), [items]);

  // Flechas / Enter / Tab mientras el menu esta abierto.
  useEffect(() => {
    keyHandler.current = (event) => {
      if (items.length === 0) return false;
      if (event.key === "ArrowDown") {
        setSelected((s) => (s + 1) % items.length);
        return true;
      }
      if (event.key === "ArrowUp") {
        setSelected((s) => (s - 1 + items.length) % items.length);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        command(items[Math.min(selected, items.length - 1)]);
        return true;
      }
      return false;
    };
    return () => {
      keyHandler.current = null;
    };
  }, [items, selected, command, keyHandler]);

  if (!rect) return null;

  // Que entre en pantalla: correrlo a la izquierda si se sale por la derecha,
  // y abrirlo hacia arriba si no entra abajo.
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - MENU_W - 8));
  const openUp = rect.bottom + MENU_H > window.innerHeight && rect.top > MENU_H;
  const style = openUp
    ? { left, bottom: window.innerHeight - rect.top + 6 }
    : { left, top: rect.bottom + 6 };

  return (
    <div className={styles.floating} style={style}>
      <BlockMenu items={items} selected={selected} onPick={command} onHover={setSelected} />
    </div>
  );
}
