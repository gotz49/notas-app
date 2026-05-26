// Indicador de "cargando". "center" lo centra en la pantalla.
import styles from "./Spinner.module.css";

export function Spinner({ center = false }: { center?: boolean }) {
  if (center) {
    return (
      <div className={styles.center}>
        <div className={styles.spinner} />
      </div>
    );
  }
  return <div className={styles.spinner} />;
}
