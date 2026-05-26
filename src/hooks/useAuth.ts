// ============================================================
//  HOOK useAuth
// ------------------------------------------------------------
//  Un "hook" es una funcion que encapsula logica de estado para
//  reusarla en cualquier componente. Este expone QUIEN esta logueado.
//
//  Cualquier componente que llame useAuth() recibe el usuario actual
//  y se re-renderiza solo cuando la sesion cambia (login / logout).
// ============================================================
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Al montar: preguntamos si ya hay una sesion guardada.
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // 2) Nos suscribimos a cambios de sesion (login, logout, refresh).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    // 3) Limpieza: cancelamos la suscripcion al desmontar.
    return () => sub.subscription.unsubscribe();
  }, []);

  return { user, loading };
}
