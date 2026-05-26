// ============================================================
//  Button  (componente reutilizable)
// ------------------------------------------------------------
//  Un boton con 3 variantes de estilo. Acepta todas las props
//  normales de un <button> (onClick, disabled, type, etc.) gracias
//  a que extendemos los atributos nativos.
// ============================================================
import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
};

export function Button({
  variant = "primary",
  className,
  ...rest
}: ButtonProps) {
  // Combinamos la clase base + la de la variante elegida.
  const classes = `${styles.button} ${styles[variant]} ${className ?? ""}`;
  return <button className={classes} {...rest} />;
}
