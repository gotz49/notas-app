// ============================================================
//  SERVICIO DE AUTENTICACION
// ------------------------------------------------------------
//  Envuelve las funciones de login/registro/logout de Supabase.
//  Los componentes NO llaman a supabase.auth directamente: llaman
//  a estas funciones. Asi, si algun dia cambias de backend, solo
//  tocas este archivo.
// ============================================================
import { supabase } from "../lib/supabase";

// Registrarse con email y contrasena.
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

// Iniciar sesion con email y contrasena.
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

// Cerrar sesion.
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
