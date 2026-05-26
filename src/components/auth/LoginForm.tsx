// ============================================================
//  LoginForm
// ------------------------------------------------------------
//  Pantalla de acceso. Alterna entre "iniciar sesion" y "crear
//  cuenta" con el mismo formulario. Llama al servicio de auth;
//  no sabe nada de Supabase directamente.
// ============================================================
import { useState } from "react";
import { signIn, signUp } from "../../services/auth.service";
import { Button } from "../ui/Button";
import styles from "./LoginForm.module.css";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setError("Cuenta creada. Revisa tu email para confirmar y luego inicia sesion.");
        setMode("signin");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ocurrio un error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>Notas</h1>
        <p className={styles.subtitle}>
          {mode === "signin" ? "Inicia sesion para continuar" : "Crea tu cuenta"}
        </p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">Email</label>
          <input
            id="email"
            className={styles.input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">Contrasena</label>
          <input
            id="password"
            className={styles.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <Button className={styles.full} onClick={handleSubmit} disabled={busy}>
          {busy ? "..." : mode === "signin" ? "Entrar" : "Registrarme"}
        </Button>

        <p className={styles.toggle}>
          {mode === "signin" ? "¿No tenes cuenta? " : "¿Ya tenes cuenta? "}
          <button
            className={styles.link}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Crear una" : "Iniciar sesion"}
          </button>
        </p>
      </div>
    </div>
  );
}
