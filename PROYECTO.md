# Proyecto: Notas

App de notas personal con sincronización entre dispositivos. Resumen para ponerse al día rápido.
Detalle técnico fino y convenciones → ver `CLAUDE.md`.

## Qué es

- App web de notas (uso diario, un solo usuario por cuenta).
- Stack: **React + TypeScript + Vite**, datos en **Supabase** (Postgres + Auth + Storage + Realtime).
- Producción: **gotz49.github.io/notas-app** — push a `main` auto-deploya vía GitHub Actions ("Deploy a GitHub Pages").
- Local: `npm run dev`. Build/type-check: `npm run build` (o `npx tsc -b`). No hay tests ni linter.
- Necesita `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).

## Arquitectura

Capas estrictas, cada una habla solo con la de al lado:

```
components/ (UI) → hooks/ (estado) → services/ (operaciones) → lib/supabase.ts → Supabase
```

- `lib/supabase.ts` — cliente único (singleton).
- `services/` — `notes.service.ts` (CRUD + realtime), `auth.service.ts`, `images.service.ts`.
- `hooks/` — `useNotes` (estado de notas), `useAuth`, `useTheme`.
- `components/` — `ui/` (genéricos), `auth/`, `notes/`.
- Tipos compartidos: solo en `src/types/index.ts`.

## Modelo de datos (tabla `notes`)

Una sola tabla. El esquema **no es automático**: pegar `supabase/schema.sql` en el SQL Editor de Supabase (es idempotente). Seguridad por **RLS** (`auth.uid() = user_id`), no en el cliente.

Campos clave: `id`, `user_id`, `kind`, `title`, `content`, `pinned`, `keywords`, `created_at`, `updated_at`.

- **`kind`** (`'nota'` | `'gastos'`) define el tipo de nota y cómo se interpreta `content`.
- `updated_at` lo actualiza un trigger en la base.

## Tipos de nota

### `nota` — texto enriquecido
- `content` = **HTML** (no Markdown). Editor TipTap/StarterKit (`components/notes/Editor.tsx`); el Markdown es solo atajo al tipear.
- **Imágenes**: no van en la base. Se suben al bucket público `imagenes` de Storage (comprimidas a WebP en el cliente), y en el HTML queda `<img src="url">`. Borrar la nota limpia sus imágenes (best-effort).
- Tiene panel lateral de **keywords** (aclaraciones atadas a la nota).

### `gastos` — listas de gastos (feature de jun-2026)
- `content` = **JSON** con forma `GastosData`: varias **listas**, cada una con renglones `{ pagado, concepto, monto }`. Tipos y helpers en `src/types/index.ts` y `src/lib/gastos.ts`.
- Se crea desde **+ Nueva → 💲 Lista de gastos**; se distingue con 💲 en la lista.
- Editor: `components/notes/GastosEditor.tsx` — tabla **✓ pagado · concepto · monto**, agregar/borrar renglones y listas, **subtotal por lista** y **total general**. Pagado = renglón tachado.
- Sin keywords ni imágenes.

## Funcionamiento clave

- **Autosave** con debounce 600ms (`NoteEditor.tsx`). Updates **optimistas** en `useNotes` (mutan estado local antes de confirmar).
- **Realtime = recarga completa**: cualquier insert/update/delete dispara un `fetchNotes` entero (`subscribeToNotes`).
- **Export** (`components/notes/exportNote.ts`): nota normal → `.txt`; nota de gastos → `.xls` (documento HTML que Excel/Sheets abren como planilla, con columnas y totales calculados, sin dependencias).
- **Menú de acciones** (`NoteActionsMenu.tsx`) compartido entre la hamburguesa del editor y el clic derecho de la lista.
- `<Editor key={note.id}>` / `<GastosEditor key={note.id}>` — el `key` fuerza remount al cambiar de nota; no quitarlo.

## Al cambiar la forma de los datos

Mantené sincronizados en conjunto: `supabase/schema.sql`, el tipo `Note` en `src/types/index.ts`, y correr la migración a mano en Supabase.
