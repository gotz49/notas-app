// ============================================================
//  LoginForm
// ------------------------------------------------------------
//  Pantalla de acceso con tres modos en el mismo formulario:
//   - "signin": iniciar sesion
//   - "signup": crear cuenta
//   - "reset":  pedir el email para recuperar la contraseña
//  Llama al servicio de auth; no sabe nada de Supabase directamente.
//  Los errores se muestran en español (utils/errors.ts).
// ============================================================
import { useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, requestPasswordReset, signIn, signUp } from "../../services/auth.service";
import { toUserMessage } from "../../utils/errors";
import { Button } from "../ui/Button";
import styles from "./LoginForm.module.css";

type Mode = "signin" | "signup" | "reset";

const TEXTS: Record<Mode, { subtitle: string; submit: string }> = {
  signin: { subtitle: "Iniciá sesión para continuar", submit: "Entrar" },
  signup: { subtitle: "Creá tu cuenta", submit: "Registrarme" },
  reset: { subtitle: "Te mandamos un email para elegir una contraseña nueva", submit: "Enviar email" },
};

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); // un <form> recarga la pagina si no lo evitamos
    setError(null);
    setNotice(null);

    if (mode === "signup" && password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        // Al entrar, useAuth detecta la sesion y App muestra las notas.
      } else if (mode === "signup") {
        const { needsConfirmation } = await signUp(email, password);
        if (needsConfirmation) {
          setMode("signin");
          setNotice("Cuenta creada. Revisá tu email para confirmarla y después iniciá sesión.");
        }
      } else {
        await requestPasswordReset(email);
        setMode("signin");
        setNotice("Si el email tiene una cuenta, te llegó un link para elegir una contraseña nueva.");
      }
    } catch (err) {
      console.error("Error de autenticacion", err);
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit} noValidate={false}>
        <h1 className={styles.title}>Notas</h1>
        <p className={styles.subtitle}>{TEXTS[mode].subtitle}</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={styles.input}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        {mode !== "reset" && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              className={styles.input}
              type="password"
              required
              minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {mode === "signup" && <span className={styles.hint}>Mínimo {MIN_PASSWORD_LENGTH} caracteres.</span>}
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}

        <Button type="submit" className={styles.full} disabled={busy}>
          {busy ? "…" : TEXTS[mode].submit}
        </Button>

        {mode === "signin" && (
          <p className={styles.toggle}>
            <button type="button" className={styles.link} onClick={() => switchMode("reset")}>
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        )}

        <p className={styles.toggle}>
          {mode === "signup" ? "¿Ya tenés cuenta? " : mode === "signin" ? "¿No tenés cuenta? " : ""}
          <button
            type="button"
            className={styles.link}
            onClick={() => switchMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Crear una" : "Volver a iniciar sesión"}
          </button>
        </p>
      </form>
    </div>
  );
}
