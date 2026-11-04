# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> El código, los comentarios y la UI están en español. Mantené esa convención al escribir código y comentarios nuevos.
> Documentación para personas: `README.md`, `PROYECTO.md` (resumen) y `docs/` (arquitectura, mapa de archivos, base de datos, mantenimiento, cambios).

## Comandos

| Comando              | Qué hace                                                    |
|----------------------|-------------------------------------------------------------|
| `npm run dev`        | Servidor de desarrollo (Vite) en `http://localhost:5173/notas-app/` |
| `npm run dev:demo`   | Igual pero con backend falso en memoria (sin Supabase ni `.env`) |
| `npm run build`      | `tsc -b && vite build` → compila a `dist/`                   |
| `npm run check`      | typecheck + lint + tests. **Correlo antes de cada commit.**  |
| `npm test`           | Tests (Vitest + jsdom)                                       |
| `npm run lint`       | ESLint                                                       |

- Tests en `src/**/*.test.ts`. La lógica difícil (autoguardado, sincronización, búsqueda) vive en `src/utils/` como funciones/clases puras justamente para poder testearla.
- La app muestra "Falta configurar Supabase" sin `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (`main.tsx`). En local: `.env` (copiá `.env.example`). En producción las toma de `.env.production` (versionado a propósito: claves públicas).
- El esquema de Supabase **no es automático**: hay que pegar `supabase/schema.sql` a mano en el SQL Editor (es idempotente). Si cambiás la forma de los datos, actualizá en conjunto: `schema.sql`, el tipo `Note` en `src/types/index.ts`, `COLUMNS` en `notes.service.ts` y `demo/fake-notes.service.ts`.
- **Push a `main` = deploy a producción** (GitHub Pages, `.github/workflows/deploy.yml`). Trabajá en ramas; `ci.yml` corre los chequeos en cada push/PR sin publicar.

## Arquitectura

Capas estrictas, cada una habla solo con la de al lado. Respetá esta dirección de dependencias al agregar código:

```
components/ (UI)  →  hooks/ (estado React)  →  services/ (operaciones)  →  lib/supabase.ts  →  Supabase
                          ↘ utils/ (lógica pura, sin React ni Supabase, con tests)
```

- **`lib/supabase.ts`** — cliente único (singleton). Es el *único* lugar que crea la conexión.
- **`services/`** — toda llamada a la tabla `notes` pasa por `notes.service.ts`; auth por `auth.service.ts`; imágenes por `images.service.ts`. Los componentes nunca llaman a Supabase directo.
- **`hooks/`** — `useNotes` (lista de notas, realtime, operaciones), `useAutosave` (cola de guardado), `useAuth`, `useTheme`.
- **`utils/`** — `autosaveQueue.ts` (cola de autoguardado), `notes.ts` (versiones, cambios realtime, orden/búsqueda), `errors.ts` (errores en español), `text.ts`.
- **`App.tsx`** solo elige pantalla según la sesión. **`Workspace.tsx`** es la pantalla principal (lo que antes era App): orquesta lista + editor, modales, historial de Android y avisos (Toast). Se monta con `key={user.id}`.
- **`components/`** — `ui/` (Button, Spinner, ThemeToggle, Toast, ErrorBoundary, MissingConfig), `auth/` (LoginForm, NewPasswordForm), `notes/`.

### Puntos no obvios

- **El contenido se guarda como HTML, no como Markdown.** El editor es TipTap/StarterKit (`components/notes/Editor.tsx`); el Markdown es solo *input shortcut*. Gastos y peso guardan **JSON** en `content` (ver `kind`).
- **Autoguardado = `utils/autosaveQueue.ts`** (vía `useAutosave`, creado en `Workspace`). `NoteEditor` solo llama `queue.queue(id, cambios)`. La cola: debounce 600ms, una pila de cambios **por nota**, de a un guardado por vez, reintentos con espera creciente (2s→30s) y al volver internet, flush al ocultar/cerrar la pestaña y aviso `beforeunload` si queda algo sin guardar. No vuelvas a meter un `setTimeout` propio en el editor.
- **Conflictos (concurrencia optimista).** `updated_at` es la *versión*: `saveNote(id, cambios, versionBase)` hace `UPDATE … WHERE updated_at = versionBase`. Si no afecta filas → `NoteConflictError` → aviso "Usar la otra versión / Quedarme con la mía" en `NoteEditor`. El trigger de la base cambia `updated_at` **solo** si cambian `title`, `content` o `keywords` (fijar o papelera no son "ediciones"). No escribas `updated_at` desde el cliente.
- **Realtime incremental.** `subscribeToNotes` entrega cada cambio y `useNotes` lo aplica con `applyRemoteChange` (ignora versiones más viejas que la que ya tiene: los "ecos" atrasados no hacen retroceder la lista). Se recarga todo solo al reconectar el canal, al volver a la pestaña o con `online`.
- **Adopción de versiones remotas.** Si la nota abierta llega con un `updated_at` más nuevo y no hay cambios pendientes, `NoteEditor` sube `revision` y `NotePanel` se monta de nuevo (`key="id:revision"`). Ese `key` también reinicia título/keywords y el historial de deshacer. No lo quites.
- **Papelera = borrado lógico** (`deleted_at`). "Borrar" en el menú → papelera (con Deshacer, sin confirmar). "Borrar para siempre" / "Vaciar papelera" → `DELETE` + limpieza de imágenes del Storage (best-effort). En la papelera la nota es de solo lectura (`Editor editable={false}`; gastos/peso dentro de `<fieldset disabled>`).
- **Las imágenes NO van en la base.** Se suben al bucket `imagenes` de Supabase Storage (`services/images.service.ts`), comprimidas a WebP en el cliente; en el HTML queda `<img src="url-publica">`. Bucket público, rutas `<user_id>/<uuid>.webp`, escribir/borrar restringido al dueño por RLS (sección 5 de `schema.sql`).
- **Bloques estilo Claude Docs** (`components/notes/blocks/`): catálogo único en `blocks.ts` para el menú "+" y el comando "/". Fecha y Desplegable son nodos inline propios guardados como `<span data-type="date|dropdown" …>`. Las opciones de extensiones TipTap se copian en profundidad: pasá **funciones** (getters), no refs/objetos, a `configure()`. Los paquetes `@tiptap/*` deben ir todos en la **misma versión**. `blocks.test.ts` verifica que el HTML se lea y guarde igual: si agregás una extensión al editor, sumala también ahí.
- **`Editor` avisa `onChange` solo si el HTML cambió** respecto del último conocido (evita guardados por normalización de TipTap al abrir una nota).
- **Layout móvil**: `Workspace.module.css` elige el panel visible con `.app > :first-child` (lista) y `:last-child` (editor). El div `.app` debe tener **solo esos dos hijos**; modales y Toast van afuera.
- **Escape**: Workspace lo usa para cerrar la nota. Todo menú/popover propio lo escucha en fase de captura con `stopPropagation` (ver `usePopoverClose`) para cerrarse solo él.
- **Seguridad por RLS**, no en el cliente. Políticas con `(select auth.uid()) = user_id`, `to authenticated`, y `with check` en update. Un trigger impide cambiar `id`, `user_id`, `kind` y `created_at`.
- **Login**: los links de email (confirmar cuenta, recuperar contraseña) vuelven a `origin + BASE_URL` (`/notas-app/`); esas URLs tienen que estar en Supabase → Authentication → URL Configuration. `useAuth` detecta `PASSWORD_RECOVERY` y App muestra `NewPasswordForm`.

### Convenciones

- Componentes en PascalCase, uno por archivo. Estilos con CSS Modules (`Componente.module.css`). Colores siempre con variables de `styles/theme.css` (claro y oscuro).
- Los tipos compartidos viven en `src/types/index.ts`.
- Errores para el usuario: `toUserMessage()` de `utils/errors.ts`; el error original va a `console.error`.
- Si agregás/cambiás una función de `services/`, replicala en `demo/` (si no, `npm run dev:demo` falla).
