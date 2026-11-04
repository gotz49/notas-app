// ============================================================
//  ErrorBoundary: si algun componente "explota" (error de codigo),
//  en vez de dejar la pantalla en blanco muestra un mensaje y un
//  boton para recargar. El error queda en la consola (F12) para
//  poder investigarlo.
//
//  Tiene que ser una clase: React todavia no tiene version con hooks.
// ============================================================
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./Button";
import styles from "./ErrorBoundary.module.css";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error inesperado en la interfaz", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={styles.wrap} role="alert">
        <h1 className={styles.title}>Algo salió mal</h1>
        <p className={styles.text}>
          La app encontró un error inesperado. Tus notas ya guardadas están a salvo en la base de datos.
        </p>
        <Button onClick={() => window.location.reload()}>Recargar</Button>
      </div>
    );
  }
}
