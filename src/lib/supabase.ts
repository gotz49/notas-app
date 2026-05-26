// ============================================================
//  CLIENTE DE SUPABASE  (punto unico de conexion)
// ------------------------------------------------------------
//  Toda la app habla con la base de datos a traves de ESTE cliente.
//  Lo creamos una sola vez y lo reutilizamos (patron "singleton").
// ============================================================
import { createClient } from "@supabase/supabase-js";

// Leemos las claves desde las variables de entorno (archivo .env).
// import.meta.env es la forma en que Vite expone esas variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Falla temprano y con un mensaje claro si faltan las claves,
// en vez de dar un error raro mas adelante.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. " +
      "Copia .env.example a .env y completa tus claves de Supabase."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
