// ============================================================
//  Mensajes de error para el usuario
// ------------------------------------------------------------
//  Supabase devuelve los errores en ingles y con detalles tecnicos.
//  toUserMessage() los traduce a un mensaje claro en español.
//  Si aparece un error nuevo que se vea feo, agregalo a RULES.
// ============================================================

type Rule = { match: RegExp; message: string };

const RULES: Rule[] = [
  { match: /invalid login credentials/i, message: "Email o contraseña incorrectos." },
  {
    match: /email not confirmed/i,
    message: "Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam).",
  },
  {
    match: /user already registered|already been registered/i,
    message: "Ya existe una cuenta con ese email. Probá iniciar sesión.",
  },
  { match: /password should be at least/i, message: "La contraseña es demasiado corta." },
  {
    match: /weak.?password|password is too weak|password .* (known|pwned|leaked)/i,
    message: "La contraseña es muy débil o conocida. Usá una más larga y única.",
  },
  {
    match: /unable to validate email|invalid email|email address .* is invalid/i,
    message: "El email no es válido.",
  },
  {
    match: /for security purposes|rate limit|too many requests/i,
    message: "Demasiados intentos. Esperá un minuto y probá de nuevo.",
  },
  {
    match: /new password should be different/i,
    message: "La nueva contraseña tiene que ser distinta de la anterior.",
  },
  {
    match: /jwt expired|invalid jwt|refresh token/i,
    message: "Tu sesión expiró. Volvé a iniciar sesión.",
  },
  {
    match: /failed to fetch|networkerror|network request failed|load failed/i,
    message: "Sin conexión con el servidor. Revisá tu internet.",
  },
  {
    match: /column .*(deleted_at|pinned)/i,
    message: "La base de datos está desactualizada: corré supabase/schema.sql en Supabase (ver README).",
  },
  {
    match: /notes_content_length/i,
    message: "La nota es demasiado larga para guardarse (máximo 1.000.000 caracteres).",
  },
  { match: /notes_title_length/i, message: "El título es demasiado largo (máximo 500 caracteres)." },
];

export function toUserMessage(error: unknown, fallback = "Ocurrió un error inesperado."): string {
  const raw = extractMessage(error);
  if (!raw) return fallback;
  const rule = RULES.find((r) => r.match.test(raw));
  return rule ? rule.message : fallback;
}

// Supabase a veces tira Error y a veces objetos { message }.
function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  if (typeof error === "string") return error;
  return "";
}
