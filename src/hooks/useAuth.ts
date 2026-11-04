// ============================================================
//  HOOK useAuth
// ------------------------------------------------------------
//  Un "hook" es una funcion que encapsula logica de estado para
//  reusarla en cualquier componente. Este expone QUIEN esta logueado.
//
//  Cualquier componente que llame useAuth() recibe el usuario actual
//  y se re-renderiza solo cuando la sesion cambia (login / logout).
//
//  Tambien avisa si el usuario llego desde el link de "recuperar
//  contraseña" (recoveringPassword = true): en ese caso la app le
//  pide una contraseña nueva antes de dejarlo entrar.
// ============================================================
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveringPassword, setRecoveringPassword] = useState(false);

  useEffect(() => {
    // onAuthStateChange avisa:
    //  - INITIAL_SESSION al arrancar (si habia una sesion guardada o no)
    //  - SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED
    //  - PASSWORD_RECOVERY cuando se abre el link de recuperar contraseña
    // Importante: no llamar otras funciones de Supabase con await aca
    // adentro (la documentacion de Supabase advierte que puede trabarse).
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      if (event === "SIGNED_OUT") setRecoveringPassword(false);
      setLoading(false);
    });

    // Limpieza: cancelamos la suscripcion al desmontar.
    return () => sub.subscription.unsubscribe();
  }, []);

  const finishPasswordRecovery = useCallback(() => setRecoveringPassword(false), []);

  return { user, loading, recoveringPassword, finishPasswordRecovery };
}
