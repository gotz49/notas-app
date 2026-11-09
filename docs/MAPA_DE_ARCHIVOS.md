# Mapa de archivos

Qué hace cada archivo y cuándo tocarlo. Cómo se conectan:
[ARQUITECTURA.md](ARQUITECTURA.md).

---

## Raíz del proyecto

| Archivo | Qué es |
|---|---|
| `index.html` | La página base. React dibuja todo dentro de `<div id="root">`. |
| `package.json` / `package-lock.json` | Dependencias y comandos. El lock lo maneja `npm` (no se edita a mano). El deploy usa `npm ci`. |
| `pnpm-lock.yaml` / `pnpm-workspace.yaml` | Restos de cuando se usaba pnpm. **No los usa nadie** (deploy y CI usan npm) y el lock de pnpm está desactualizado. Se pueden borrar. |
| `vite.config.ts` | Vite (compilar/servir, `base: "/notas-app/"` para GitHub Pages) y Vitest (tests). |
| `tsconfig.json` / `tsconfig.node.json` | TypeScript para `src/` y para `vite.config.ts`. |
| `eslint.config.js` | Reglas de ESLint (`npm run lint`). |
| `.env.example` | Plantilla de claves para desarrollo (se copia a `.env`, que no se sube). |
| `.env.production` | Claves **públicas** de Supabase para el build de producción. Versionado a propósito. Nunca poner acá una `service_role`. |
| `.nvmrc` / `.editorconfig` | Versión de Node recomendada (22) / formato básico para cualquier editor. |
| `.github/workflows/deploy.yml` | **Push a `main` → build → GitHub Pages** (producción). |
| `.github/workflows/ci.yml` | En cada push/PR: tipos + lint + tests + build. No publica. |
| `public/` | Se copia tal cual: `manifest.json` (PWA), `icon.svg`, `sw.js` (service worker). |
| `supabase/schema.sql` | **Todo el esquema de la base.** Idempotente. Ver [BASE_DE_DATOS.md](BASE_DE_DATOS.md). |
| `demo/` | Modo demo (`npm run dev:demo`): servicios falsos para probar la interfaz sin Supabase. |
| `README.md`, `PROYECTO.md`, `CLAUDE.md`, `docs/` | Documentación. |

---

## `src/`

### Entrada y pantallas de nivel superior

| Archivo | Qué hace | Tocalo si… |
|---|---|---|
| `main.tsx` | Arranca React. Sin claves → `MissingConfig`; con claves carga `App` dentro de `ErrorBoundary`. Registra el service worker. | Casi nunca. |
| `App.tsx` | Elige pantalla: spinner / nueva contraseña / login / `Workspace`. | Agregás una pantalla de nivel superior. |
| `Workspace.tsx` | **Pantalla principal.** Junta `useNotes` + `useAutosave`; nota abierta, pestaña, modales, panel de keywords, Esc, gesto "atrás" de Android; acciones que pueden fallar (crear, papelera, borrar, fijar, exportar, salir) con avisos. | Cambiás qué pasa al hacer una acción. |
| `Workspace.module.css` | Layout lista + editor; en móvil, un panel a la vez (`.showEditor`). ⚠️ usa `:first-child`/`:last-child`. | — |
| `vite-env.d.ts` | Tipos de las variables `VITE_…`. | Agregás una variable de entorno. |

### `types/`

| Archivo | Qué hace |
|---|---|
| `types/index.ts` | `Note` (con `kind`, `keywords`, `pinned`, `deleted_at`), `NoteUpdate` (lo que guarda el autoguardado: título/contenido/keywords), `RemoteNoteChange`, y los tipos de gastos y peso. **Si cambiás `schema.sql`, actualizalo.** |

### `lib/`

| Archivo | Qué hace | Test |
|---|---|---|
| `lib/supabase.ts` | El único cliente de Supabase. | — |
| `lib/gastos.ts` | Leer/escribir el JSON de gastos, ingresos/gastos, USD, subtotales y resumen, cuotas (y convertir el formato viejo), **cerrar mes**, historial, comparación con el mes anterior y vencimientos. | `gastos-peso.test.ts`, `gastos-mes.test.ts` |
| `lib/peso.ts` | Leer/escribir el JSON de peso, ordenar y filtrar por fecha, formatos. | `gastos-peso.test.ts` |
| `lib/pesoChart.ts` | Dibuja el gráfico de peso en un `<canvas>` (para exportar PNG). | — |

### `utils/` — lógica pura (sin React ni Supabase)

| Archivo | Qué hace | Test |
|---|---|---|
| `utils/autosaveQueue.ts` | **Cola de autoguardado**: debounce, una pila por nota, de a un guardado, reintentos, conflictos (`keepMine` / `keepTheirs`). | `autosaveQueue.test.ts` |
| `utils/notes.ts` | Versiones con microsegundos (`isNewer`), aplicar cambios de Realtime sin retroceder (`applyRemoteChange`), qué notas mostrar y en qué orden (`selectVisibleNotes`), contar papelera. | `notes.test.ts` |
| `utils/errors.ts` | `toUserMessage`: errores de Supabase → mensaje en español. | `text.test.ts` |
| `utils/text.ts` | `normalize` (sin tildes) y `toPlainText` (HTML → texto, para buscar). | `text.test.ts` |

### `services/` — hablan con Supabase (sin estado)

| Archivo | Qué hace | Tocalo si… |
|---|---|---|
| `services/notes.service.ts` | `fetchNotes`, `fetchNote`, `createNote(kind)`, `saveNote` con control de versión (`NoteConflictError` / `NoteNotFoundError`), `setPinned`, `moveToTrash`, `restoreFromTrash`, `deleteNote`, `emptyTrash`, `subscribeToNotes` (Realtime incremental). | Nueva operación sobre notas (**replicala en `demo/`**). |
| `services/images.service.ts` | Comprimir a WebP y subir a Storage; borrar las imágenes de una nota. | Cambiás tamaño/calidad de imágenes. |
| `services/auth.service.ts` | Registro, login, recuperar/cambiar contraseña, logout. `MIN_PASSWORD_LENGTH`. URL de vuelta de los emails. | Cambiás el login. |

### `hooks/` — estado de React

| Archivo | Qué hace | Lo usa |
|---|---|---|
| `hooks/useNotes.ts` | Lista de notas: carga, Realtime, recargas de respaldo, y operaciones optimistas (crear, guardar, fijar, papelera, borrar, subir imagen). | Workspace |
| `hooks/useAutosave.ts` | Envuelve `AutosaveQueue`; guarda al ocultar/cerrar la pestaña, avisa antes de cerrar, reintenta con `online`. | Workspace → NoteEditor |
| `hooks/useAuth.ts` | Usuario logueado y modo "recuperando contraseña". | App |
| `hooks/useTheme.ts` | Modo claro/oscuro (recordado en el navegador). | ThemeToggle |

### `components/notes/`

| Archivo | Qué hace |
|---|---|
| `NoteList.tsx` (+ `.module.css`) | Barra lateral: tema, "+ Nueva" (nota / gastos / peso), colapsar, buscador, pestañas **Notas / Papelera**, lista, "Vaciar papelera", email y "Salir". Clic derecho → `NoteActionsMenu`. |
| `NoteListItem.tsx` | Una fila: 📌 / 💲 / ⚖️, título, fecha (o "Borrada el…" en la papelera). |
| `NoteEditor.tsx` (+ `.module.css`) | **Contenedor** de la nota abierta (avisos de papelera y conflicto, adopción de versiones remotas) + `NotePanel` (barra, título, editor según `kind`, keywords) + `SaveIndicator`. |
| `NoteActionsMenu.tsx` | Menú de acciones (Keywords, Atajos, Fijar, Exportar, Mover a la papelera), en ☰ y clic derecho. |
| `Editor.tsx` (+ `.module.css`) | Editor TipTap de notas de texto: extensiones, menú de formato (clic derecho / Aa), menú "+", comando "/", imágenes (pegar, arrastrar, elegir). Prop `editable`. |
| `GastosEditor.tsx` (+ css) | Gastos del mes: barra del mes, resumen, avisos (vencimientos, convertir formato viejo, deshacer cierre), listas y saldo. |
| `gastos/RenglonOpciones.tsx` (+ css) | Menú ⋯ de un renglón: gasto/ingreso, cuota, solo este mes, US$. |
| `gastos/CerrarMesDialog.tsx` (+ css) | Vista previa y confirmación de "Cerrar mes". |
| `gastos/GastosHistorial.tsx` (+ css) | Historial de meses cerrados: gráfico SVG y tabla con detalle por lista. |
| `PesoEditor.tsx` (+ css) | Registro de peso: alta por fecha y listado editable. |
| `PesoExportDialog.tsx` (+ css) | Exportar peso como PNG con gráfico y rango de fechas. |
| `exportNote.ts` | Exportar nota de texto (.txt) o gastos (.xls, con resumen e historial). |
| `ShortcutsHelp.tsx` (+ css) | Modal con los atajos de teclado. |
| `blocks/blocks.ts` | **Catálogo de bloques** para "+" y "/". |
| `blocks/DateChip.tsx`, `blocks/DropdownChip.tsx` | Bloques Fecha y Desplegable (nodos TipTap con vista React). |
| `blocks/SlashCommand.ts`, `blocks/SlashMenu.tsx`, `blocks/BlockMenu.tsx` | Comando "/" y menús de bloques. |
| `blocks/icons.tsx`, `blocks/usePopoverClose.ts`, `blocks/*.module.css` | Íconos, cerrar popovers (clic afuera / Esc), estilos. |
| `blocks/blocks.test.ts` | Tests: el HTML de las notas se lee y guarda igual; HTML peligroso descartado; catálogo. |

### `components/auth/` y `components/ui/`

| Archivo | Qué hace |
|---|---|
| `auth/LoginForm.tsx` (+ css) | Entrar / crear cuenta / pedir recuperación de contraseña. |
| `auth/NewPasswordForm.tsx` | Elegir contraseña nueva tras el link del email. |
| `ui/Button.tsx`, `ui/Spinner.tsx`, `ui/ThemeToggle.tsx` | Piezas genéricas. |
| `ui/Toast.tsx` (+ css) | Avisos temporales con acción ("Deshacer") y `useToast()`. |
| `ui/ErrorBoundary.tsx` (+ css) | "Algo salió mal" + Recargar ante un error de código. |
| `ui/MissingConfig.tsx` | "Falta configurar Supabase". |

### `styles/`

| Archivo | Qué hace |
|---|---|
| `styles/theme.css` | **Colores** (claro y `[data-theme="dark"]`), fuentes, espaciados. Usá siempre estas variables. |
| `styles/global.css` | Reset, layout "app-shell" (solo scrollea el cuerpo de la nota). |

---

## "Quiero cambiar X, ¿qué toco?"

| Quiero… | Archivo(s) |
|---|---|
| Colores / modo oscuro | `src/styles/theme.css` |
| Un texto de la pantalla | El componente (buscalo con Ctrl+Shift+F) |
| Un mensaje de error | `src/utils/errors.ts` |
| Agregar un bloque al "+" / "/" | `src/components/notes/blocks/blocks.ts` (+ `icons.tsx`) |
| Un ítem del menú de formato | `Editor.tsx` → `ContextMenu` |
| Una acción del menú ☰ / clic derecho | `NoteActionsMenu.tsx` + el handler en `Workspace.tsx` |
| Tiempo de autoguardado | `src/utils/autosaveQueue.ts` (`delayMs`, 600) |
| Orden o búsqueda de la lista | `src/utils/notes.ts` → `selectVisibleNotes` |
| Un tipo de nota nuevo | Ver [MANTENIMIENTO.md](MANTENIMIENTO.md#agregar-un-tipo-de-nota) |
| Un campo nuevo en las notas | Ver [MANTENIMIENTO.md](MANTENIMIENTO.md#agregar-un-campo-a-las-notas) |
| Seguridad de la base | `supabase/schema.sql` |
