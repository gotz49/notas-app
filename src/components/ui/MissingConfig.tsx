// ============================================================
//  MissingConfig: pantalla que se muestra si faltan las claves de
//  Supabase (archivo .env en desarrollo, o variables de entorno en
//  el servicio donde se publico la app). Sin esto se veria una
//  pantalla en blanco. La decide main.tsx antes de cargar la app.
// ============================================================
import styles from "./ErrorBoundary.module.css";

export function MissingConfig() {
  return (
    <div className={styles.wrap} role="alert">
      <h1 className={styles.title}>Falta configurar Supabase</h1>
      <p className={styles.text}>
        No se encontraron <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code>.
      </p>
      <p className={styles.text}>
        En tu computadora: copiá <code>.env.example</code> como <code>.env</code>, completá las claves y reiniciá{" "}
        <code>npm run dev</code>. En un sitio publicado: cargá esas dos variables en el panel del servicio de hosting y
        volvé a publicar. (Ver README.)
      </p>
    </div>
  );
}
