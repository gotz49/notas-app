# Proyecto: Notas

App de notas personal con sincronización entre dispositivos. Resumen para ponerse al día rápido.
Detalle técnico fino y convenciones → ver `CLAUDE.md`.

## Qué es

- App web de notas (uso diario, un solo usuario por cuenta).
- Stack: **React + TypeScript + Vite**, datos en **Supabase** (Postgres + Auth + Storage + Realtime).
- Producción: **gotz49.github.io/notas-app** — push a `main` auto-deploya vía GitHub Actions ("Deploy a GitHub Pages").
- Local: `npm run dev` (o `npm run dev:demo`, sin Supabase). Antes de cada commit: `npm run check` (tipos + ESLint + tests con Vitest). `ci.yml` corre lo mismo en GitHub en cada push/PR.
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

Campos clave: `id`, `user_id`, `kind`, `title`, `content`, `pinned`, `keywords`, `deleted_at`, `created_at`, `updated_at`.

- **`kind`** (`'nota'` | `'gastos'` | `'peso'`) define el tipo de nota y cómo se interpreta `content`. Es texto libre (sin CHECK): sumar un tipo nuevo no requiere migración.
- `updated_at` lo actualiza un trigger en la base **solo** cuando cambia `title`, `content` o `keywords`: es la *versión* de la nota (sirve para detectar conflictos entre dispositivos). El mismo trigger impide cambiar `id`, `user_id`, `kind` y `created_at`.
- `deleted_at`: papelera (`null` = normal). Detalle completo de la base: `docs/BASE_DE_DATOS.md`.

## Tipos de nota

### `nota` — texto enriquecido
- `content` = **HTML** (no Markdown). Editor TipTap/StarterKit (`components/notes/Editor.tsx`); el Markdown es solo atajo al tipear.
- **Formato**: menú con Negrita/Títulos/Listas/etc. (`ContextMenu` en `Editor.tsx`). Se abre con **clic derecho** (desktop) o el botón **Aa** de la barra (sobre todo móvil). En móvil el long-press queda libre para la **selección nativa** de Android (copiar/pegar del sistema); el botón Aa cierra ese popup nativo (`blur` + `removeAllRanges`, la selección la conserva ProseMirror) y aplica el formato sobre lo seleccionado. Los menús flotantes se **centran en pantalla** en móvil.
- **Bloques (estilo Claude Docs)**: botón **+** de la barra o escribir **/** en el texto (al inicio de línea o tras un espacio) abre el menú de bloques: lista con viñetas, checklist, bloque de código, fecha, divisor, desplegable, títulos 1-3, lista numerada, cita; con **/** además Texto, Tabla e Imagen. El catálogo único vive en `components/notes/blocks/blocks.ts` (lo usan los dos menús). El menú **Aa** suma Checklist y, con el cursor en una tabla, agregar/borrar filas y columnas.
  - **Fecha** y **Desplegable** son nodos propios (`blocks/DateChip.tsx`, `blocks/DropdownChip.tsx`): pastillas dentro del texto. En el HTML quedan como `<span data-type="date" data-value="YYYY-MM-DD">` y `<span data-type="dropdown" data-value="…" data-options='[…]'>`, con el texto visible adentro (así el export `.txt` lo muestra).
  - Todo se guarda en el mismo `content` HTML: **no hay cambios de esquema**. Las notas viejas se leen y re-guardan idénticas (solo se agregaron extensiones).
- **Imágenes**: no van en la base. Se suben al bucket público `imagenes` de Storage (comprimidas a WebP en el cliente), y en el HTML queda `<img src="url">`. Borrar la nota **para siempre** (desde la papelera) limpia sus imágenes (best-effort).
- Tiene panel lateral de **keywords** (aclaraciones atadas a la nota).

### `gastos` — listas de gastos (feature de jun-2026)
- `content` = **JSON** con forma `GastosData`: varias **listas**, cada una con renglones `{ pagado, concepto, monto }`. Tipos y helpers en `src/types/index.ts` y `src/lib/gastos.ts`.
- Se crea desde **+ Nueva → 💲 Lista de gastos**; se distingue con 💲 en la lista.
- Editor: `components/notes/GastosEditor.tsx` — tabla **✓ pagado · concepto · monto**, agregar/borrar renglones y listas, **subtotal por lista** y **total general**. Pagado = renglón tachado.
- Sin keywords ni imágenes.

### `peso` — registro diario de peso (feature de jun-2026)
- `content` = **JSON** con forma `PesoData`: lista de registros `{ fecha, peso }`. Cada registro lleva **su propia fecha** (`YYYY-MM-DD`), así se puede cargar un día olvidado o corregir cualquier valor. Tipos y helpers en `src/types/index.ts` y `src/lib/peso.ts`.
- Se crea desde **+ Nueva → ⚖️ Registro de peso**; se distingue con ⚖️ en la lista.
- Editor: `components/notes/PesoEditor.tsx` — **form** de carga (fecha + peso) arriba; **listado** editable/borrable abajo, del más reciente al más viejo. Sin keywords ni imágenes.
- **Export = imagen** (no `.xls`): `PesoExportDialog.tsx` abre un modal para elegir **rango de fechas** (presets 7/30 días/todo), muestra vista previa y descarga/comparte un **PNG** con un gráfico de línea (eje X = tiempo, eje Y = peso con margen automático). El gráfico lo pinta `src/lib/pesoChart.ts` en `<canvas>`, sin dependencias.

## Funcionamiento clave

- **Autosave**: cola en `utils/autosaveQueue.ts` (vía `hooks/useAutosave`, creada en `Workspace.tsx`). Debounce 600ms, cambios **acumulados por nota**, de a un guardado por vez, **reintentos** si falla (2s→30s y al volver internet), guarda al pasar a segundo plano y avisa antes de cerrar si queda algo sin guardar. Estado visible en la barra: "Guardando…", "Guardado ✓" o el error con **Reintentar**.
- **Conflictos**: cada guardado lleva la versión (`updated_at`) sobre la que se escribió; si otro dispositivo guardó en el medio, no se pisa nada y aparece un aviso para elegir **"Usar la otra versión"** o **"Quedarme con la mía"**. Si la nota abierta cambia en otro dispositivo y no estás escribiendo, se actualiza sola.
- **Papelera**: borrar manda a la papelera (con **Deshacer**); desde la pestaña Papelera se restaura, se borra para siempre o se vacía (recién ahí se limpian las imágenes del Storage). Updates **optimistas** en `useNotes`: si el servidor falla, vuelven atrás y se muestra un aviso.
- **Realtime incremental**: cada cambio se aplica directo a la lista (`utils/notes.ts` → `applyRemoteChange`, que ignora "ecos" viejos). Recarga completa solo al reconectar, al volver a la pestaña o al recuperar internet.
- **Export**: el menú de acciones llama `onExport` (lo rutea `Workspace.handleExport`). Nota normal → `.txt` y gastos → `.xls` van directo por `components/notes/exportNote.ts`; **peso → PNG** abre el modal `PesoExportDialog.tsx` (rango de fechas + gráfico).
- **Gesto/botón atrás de Android** (`Workspace.tsx`): al abrir una nota se mete una entrada de historial (`pushState`); el gesto de borde dispara `popstate` y vuelve al listado en vez de cerrar la PWA.
- **Menú de acciones** (`NoteActionsMenu.tsx`) compartido entre la hamburguesa del editor y el clic derecho de la lista.
- **Layout app-shell**: `html`/`body` con `overflow:hidden` y todo a `height:100%`; el único que scrollea es `.main` (cuerpo de la nota), así la **barra superior del editor queda fija** siempre. ⚠️ Un menú `position:fixed` se rompe si un ancestro tiene `transform` (pasa a ser su bloque contenedor y el menú queda fuera de pantalla): por eso `.inner` y los `.menu` usan fades de **solo opacidad**, sin transform.
- `NotePanel key="id:revision"` (en `NoteEditor.tsx`) — fuerza remount del editor al cambiar de nota o al adoptar una versión remota; no quitarlo.
- **Layout móvil**: `Workspace.module.css` elige el panel con `.app > :first-child` / `:last-child`; el div `.app` tiene **solo** lista y editor (modales y avisos van afuera).

## Al cambiar la forma de los datos

Mantené sincronizados en conjunto: `supabase/schema.sql`, el tipo `Note` en `src/types/index.ts`, `COLUMNS` en `src/services/notes.service.ts`, `demo/fake-notes.service.ts`, y correr la migración a mano en Supabase. Receta paso a paso: `docs/MANTENIMIENTO.md`.
