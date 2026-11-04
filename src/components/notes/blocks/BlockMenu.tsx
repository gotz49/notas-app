// ============================================================
//  Lista de bloques (la usan el menu "+" y el menu "/").
//  Componente "tonto": muestra los items y avisa cual se eligio.
// ============================================================
import { useEffect, useRef } from "react";
import type { BlockDef } from "./blocks";
import { Icon } from "./icons";
import styles from "./BlockMenu.module.css";

type Props = {
  items: BlockDef[];
  selected: number;
  onPick: (item: BlockDef) => void;
  onHover?: (index: number) => void;
  footer?: string;
};

export function BlockMenu({ items, selected, onPick, onHover, footer }: Props) {
  const listRef = useRef<HTMLDivElement>(null);

  // Mantener visible el item seleccionado al moverse con las flechas.
  useEffect(() => {
    const el = listRef.current?.children[selected] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <div className={styles.menu} role="menu">
      <div ref={listRef} className={styles.list}>
        {items.length === 0 && <div className={styles.empty}>Sin resultados</div>}
        {items.map((item, i) => (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className={`${styles.item} ${i === selected ? styles.itemActive : ""}`}
            // mousedown + preventDefault: elegir no le saca el foco al editor
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onPick(item);
            }}
            onMouseEnter={() => onHover?.(i)}
          >
            <Icon name={item.icon} />
            {item.label}
          </button>
        ))}
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
