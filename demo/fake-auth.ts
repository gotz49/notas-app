/* eslint-disable */
// Sesion FALSA (solo para "npm run dev:demo"): reemplaza a
// services/auth.service.ts y hooks/useAuth.ts. Siempre hay un usuario
// "demo@ejemplo.com" logueado.
export const MIN_PASSWORD_LENGTH = 8;
export async function signUp() {
  return { needsConfirmation: true };
}
export async function signIn() {}
export async function requestPasswordReset() {}
export async function updatePassword() {}
export async function signOut() {
  (window as any).__signedOut = true;
}
const user = { id: "u1", email: "demo@ejemplo.com" };
export function useAuth() {
  return { user, loading: false, recoveringPassword: false, finishPasswordRecovery() {} };
}
