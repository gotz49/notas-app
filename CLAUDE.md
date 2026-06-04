# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> El código, los comentarios y la UI están en español. Mantené esa convención al escribir código y comentarios nuevos.

## Comandos

| Comando           | Qué hace                                          |
|-------------------|---------------------------------------------------|
| `npm run dev`     | Servidor de desarrollo (Vite), recarga en vivo    |
| `npm run build`   | `tsc -b && vite build` → compila a `dist/`         |
| `npm run preview` | Previsualiza la build de producción               |

- No hay framework de tests ni linter configurado. El chequeo de tipos ocurre dentro de `npm run build` (`tsc -b`); para validar tipos sin compilar a disco usá `npx tsc -b`.
- La app **no arranca sin** las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env` (ver `src/lib/supabase.ts`, que lanza un error temprano si faltan). Copiá `.env.example` a `.env`.
- El esquema de Supabase **no es automático**: hay que pegar `supabase/schema.sql` a mano en el SQL Editor de Supabase. Si cambiás la forma de los datos, actualizá ese archivo y el tipo `Note` en `src/types/index.ts` en conjunto.

## Arquitectura

Capas estrictas, cada una habla solo con la de al lado. Respetá esta dirección de dependencias al agregar código:

```
components/  (UI)  →  hooks/  (estado React)  →  services/  (operaciones)  →  lib/supabase.ts  →  Supabase
```

- **`lib/supabase.ts`** — cliente único (singleton). Es el *único* lugar que crea la conexión; todo lo demás lo importa.
- **`services/`** — toda llamada a la tabla `notes` pasa por `notes.service.ts`; auth por `auth.service.ts`. Los componentes nunca llaman a Supabase directo. Si cambiás de backend, idealmente solo se tocan `lib/` y `services/`.
- **`hooks/`** — `useNotes` concentra el estado de notas; `useAuth` expone el usuario logueado; `useTheme` el modo claro/oscuro. Los componentes consumen estos hooks, no los servicios.
- **`components/`** — divididos en `ui/` (genéricos: Button, Spinner, ThemeToggle), `auth/` y `notes/`. Componentes "tontos" (ej. `NoteListItem`) solo muestran datos y emiten eventos; la lógica vive en el padre o en los hooks.

### Puntos no obvios

- **El contenido se guarda como HTML, no como Markdown.** Pese al nombre "Notas en Markdown", el editor es TipTap/StarterKit (`components/notes/Editor.tsx`): el Markdown es solo *input shortcut* mientras tipeás (`# `, `- `, `**`), pero `note.content` es el HTML que produce `editor.getHTML()`. (Nota: `MarkdownPreview.tsx` fue eliminado; el README todavía lo menciona.)
- **Las imágenes NO van en la base.** Se suben al bucket `imagenes` de Supabase Storage (`services/images.service.ts`) y en el HTML de la nota queda solo `<img src="url-publica">`. Antes de subir se comprimen en el cliente (reescalado + WebP, con `<canvas>`). El bucket es público (para que el `<img>` cargue directo) con rutas `<user_id>/<uuid>.webp`; escribir/borrar está restringido al dueño por RLS (ver sección 5 de `schema.sql`, que hay que correr a mano). Al borrar una nota, `useNotes.remove` limpia sus imágenes del Storage (best-effort, parseando el HTML); quitar una imagen *editando* la nota no la borra del bucket.
- **Realtime = recarga completa.** `subscribeToNotes` (en `notes.service.ts`) escucha cualquier `insert/update/delete` y dispara `reload()` en `useNotes`, que re-hace el `fetchNotes` entero. No hay merge incremental por evento.
- **Updates optimistas.** `useNotes.update`/`create`/`remove` mutan el estado local *antes* de confirmar con el servidor. El realtime después reconcilia. Tenelo en cuenta si tocás el flujo de guardado.
- **Autosave con debounce de 600ms** en `NoteEditor.tsx` (`scheduleSave`). El título tiene estado local propio que se re-sincroniza al cambiar `note.id`.
- **`<Editor key={note.id}>`** fuerza un remount del editor TipTap al cambiar de nota (TipTap no reacciona bien a cambios de `content` por prop). No quites ese `key`.
- **Seguridad por RLS**, no en el cliente. Las políticas de `schema.sql` (`auth.uid() = user_id`) son lo que impide ver notas ajenas; el cliente usa la `anon key` pública. `updated_at` lo maneja un trigger en la base, no la app.

### Convenciones

- Componentes en PascalCase, uno por archivo. Estilos con CSS Modules (`Componente.module.css`).
- Los tipos compartidos viven solo en `src/types/index.ts`.
