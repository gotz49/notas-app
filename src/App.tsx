// ============================================================
//  App  (componente raiz)
// ------------------------------------------------------------
//  Solo decide QUE pantalla mostrar segun la sesion:
//   - cargando sesion                  -> spinner
//   - viene del link "recuperar clave" -> NewPasswordForm
//   - sin usuario logueado             -> formulario de login
//   - usuario logueado                 -> Workspace (lista + editor)
//
//  key={user.id}: si cambia el usuario, React destruye el Workspace
//  anterior y crea uno nuevo. Asi nunca se ven (ni quedan en memoria)
//  las notas de la cuenta anterior.
// ============================================================
import { useAuth } from "./hooks/useAuth";
import { LoginForm } from "./components/auth/LoginForm";
import { NewPasswordForm } from "./components/auth/NewPasswordForm";
import { Spinner } from "./components/ui/Spinner";
import { Workspace } from "./Workspace";

export default function App() {
  const { user, loading, recoveringPassword, finishPasswordRecovery } = useAuth();

  // 1) Esperando saber si hay sesion.
  if (loading) return <Spinner center />;

  // 2) Llego desde el email de "recuperar contrasena": pedir la nueva.
  if (user && recoveringPassword) return <NewPasswordForm onDone={finishPasswordRecovery} />;

  // 3) Nadie logueado -> pantalla de acceso.
  if (!user) return <LoginForm />;

  // 4) Logueado: app principal.
  return <Workspace key={user.id} user={user} />;
}
