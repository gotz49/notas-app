// ============================================================
//  NewPasswordForm
// ------------------------------------------------------------
//  Se muestra cuando el usuario abre el link de "recuperar
//  contraseña" que le llego por email (useAuth detecta el evento
//  PASSWORD_RECOVERY). Le pide la contraseña nueva y la guarda.
// ============================================================
import { useState, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH, updatePassword } from "../../services/auth.service";
import { toUserMessage } from "../../utils/errors";
import { Button } from "../ui/Button";
import styles from "./LoginForm.module.css";

export function NewPasswordForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`La contraseña tiene que tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      await updatePassword(password);
      onDone(); // listo: App muestra las notas
    } catch (err) {
      console.error("No se pudo cambiar la contraseña", err);
      setError(toUserMessage(err, "No se pudo cambiar la contraseña."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Nueva contraseña</h1>
        <p className={styles.subtitle}>Elegí una contraseña nueva para tu cuenta.</p>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="new-password">
            Contraseña nueva
          </label>
          <input
            id="new-password"
            className={styles.input}
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="confirm-password">
            Repetila
          </label>
          <input
            id="confirm-password"
            className={styles.input}
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className={styles.full} disabled={busy}>
          {busy ? "…" : "Guardar contraseña"}
        </Button>
      </form>
    </div>
  );
}
