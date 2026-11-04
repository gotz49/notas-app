# Base de datos (Supabase)

Todo está en **`supabase/schema.sql`** (es la referencia). Acá se explica
qué hace cada parte y por qué.

---

## Tabla `public.notes`

| Columna | Tipo | Para qué |
|---|---|---|
| `id` | `uuid` PK | Lo genera la base. |
| `user_id` | `uuid` → `auth.users` | Dueño. Si se borra el usuario, se borran sus notas. |
| `kind` | `text`, default `'nota'` | `'nota'` (HTML) · `'gastos'` (JSON) · `'peso'` (JSON). Sin CHECK: sumar un tipo no requiere migración. No se puede cambiar después de crear. |
| `title` | `text` | Título (máx. 500 caracteres). |
| `content` | `text` | HTML (nota) o JSON (gastos/peso). Máx. 1.000.000 caracteres. Las imágenes NO van acá: solo su URL. |
| `pinned` | `boolean` | Fijada arriba de la lista. |
| `keywords` | `text` | Panel de aclaraciones de las notas de texto. |
| `deleted_at` | `timestamptz`, null | **Papelera.** `null` = normal; con fecha = en la papelera desde entonces. |
| `created_at` | `timestamptz` | No se puede cambiar. |
| `updated_at` | `timestamptz` | **Versión de la nota.** Cambia solo con título, contenido o keywords. |

Índice `notes_user_id_updated_at_idx (user_id, updated_at desc)`.

Si cambiás columnas, actualizá también: `src/types/index.ts` (`Note`),
`COLUMNS` en `src/services/notes.service.ts` y `demo/fake-notes.service.ts`.

## Límites de tamaño

`check` con `not valid`: se aplican a las escrituras nuevas sin revisar las
notas existentes (el script nunca falla por datos viejos). Si se superan, la
app muestra un mensaje claro y no reintenta ese guardado.

## Trigger `notes_before_update`

Corre antes de cada UPDATE:
1. **Protege** `id`, `user_id`, `kind` y `created_at`: aunque alguien mande
   otro valor desde el navegador, se conserva el original (nadie puede
   "regalar" una nota a otro usuario).
2. **`updated_at`** pasa a `now()` solo si cambió `title`, `content` o
   `keywords`. Fijar o mandar a la papelera no cuenta como edición.

¿Por qué el punto 2? La app usa `updated_at` como número de versión para
detectar conflictos entre dispositivos ([ARQUITECTURA.md](ARQUITECTURA.md#43-sincronización-y-conflictos)).
Si fijar cambiara la versión, quien estuviera escribiendo en otro dispositivo
recibiría un falso aviso de conflicto.

Reemplaza al trigger anterior `notes_set_updated_at` / función
`set_updated_at` (el script los borra). Tiene `set search_path = ''`
(recomendación de seguridad de Supabase).

## Seguridad: RLS

La anon/publishable key es pública (va en el bundle de la web). Lo que impide
leer notas ajenas es **Row Level Security**:

| Política | Operación | Regla |
|---|---|---|
| `leer mis notas` | SELECT | `(select auth.uid()) = user_id` |
| `crear mis notas` | INSERT | ídem (`with check`) |
| `editar mis notas` | UPDATE | ídem en `using` **y** `with check` |
| `borrar mis notas` | DELETE | ídem |

Todas `to authenticated`. `(select auth.uid())` se calcula una vez por
consulta en vez de una por fila. **Nunca** pongas la `service_role` key en
la app ni en `.env.production`: saltea RLS.

## Storage (imágenes)

Bucket `imagenes`, **público** (para que `<img src>` funcione directo), rutas
`<user_id>/<uuid>.webp` (no adivinables). Subir/actualizar/borrar: solo en
la carpeta propia (`storage.foldername(name)[1] = auth.uid()`). Las imágenes
de una nota se borran al **borrarla para siempre** (no al mandarla a la
papelera, así se puede restaurar). Quitar una imagen editando la nota no la
borra del bucket.

## Realtime

La tabla está en `supabase_realtime`. Realtime respeta RLS. La app escucha:
- `INSERT`/`UPDATE` con filtro `user_id=eq.<id>`;
- `DELETE` sin filtro (Supabase no permite filtrarlos): llegan solo con el
  `id`, sin contenido; si no es nuestro, no pasa nada.

## Actualizar la base

El script es **idempotente** (`if not exists`, `drop … if exists`). Para
aplicar esta versión:

1. Supabase → **SQL Editor** → New query → pegá **todo** `schema.sql` → **Run**.
2. Hacelo **antes** de publicar la app nueva. El orden importa: la app nueva
   necesita la columna `deleted_at`. Al revés no hay problema: la app vieja
   sigue funcionando con la base nueva.

Síntoma de base desactualizada: "La base de datos está desactualizada: corré
supabase/schema.sql…" al entrar.

## Copias de seguridad

Supabase hace backups según el plan (Settings → Database). Copia manual:
SQL Editor → `select title, kind, content, keywords, updated_at from notes;`
→ "Download CSV". Las imágenes están en Storage → `imagenes`.
