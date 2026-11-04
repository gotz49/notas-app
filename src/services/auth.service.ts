// ============================================================
//  SERVICIO DE AUTENTICACION
// ------------------------------------------------------------
//  Envuelve las funciones de login/registro/logout de Supabase.
//  Los componentes NO llaman a supabase.auth directamente: llaman
//  a estas funciones. Asi, si algun dia cambias de backend, solo
//  tocas este archivo.
//
//  Los errores se tiran tal cual vienen de Supabase (en ingles);
//  la pantalla los traduce con utils/errors.ts -> toUserMessage().
// ============================================================
import { supabase } from "../lib/supabase";

// Largo minimo de contraseña que pide la app al registrarse o cambiarla.
// (Supabase tiene su propio minimo en Authentication -> Providers -> Email;
// conviene que sean iguales.)
export const MIN_PASSWORD_LENGTH = 8;

// A donde vuelve el usuario al tocar el link del email (confirmacion o
// recuperacion de contraseña). Incluye BASE_URL porque en GitHub Pages la
// app vive en "/notas-app/" (ver vite.config.ts). Esta URL tiene que estar
// permitida en Supabase -> Authentication -> URL Configuration -> Redirect URLs
// (ej. https://gotz49.github.io/notas-app/ y http://localhost:5173/notas-app/).
function appUrl(): string {
  return window.location.origin + import.meta.env.BASE_URL;
}

// Registrarse con email y contraseña.
// Devuelve needsConfirmation = true si Supabase pide confirmar el email
// antes de poder entrar (opcion "Confirm email" activada en Supabase).
export async function signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: appUrl() },
  });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

// Iniciar sesion con email y contraseña.
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Enviar email para recuperar la contraseña. El link del email abre la
// app con una sesion temporal y Supabase emite el evento
// "PASSWORD_RECOVERY" (lo detecta hooks/useAuth.ts).
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl() });
  if (error) throw error;
}

// Cambiar la contraseña del usuario logueado (se usa tras la recuperacion).
export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Cerrar sesion.
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
