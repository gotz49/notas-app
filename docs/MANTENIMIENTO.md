# Mantenimiento

Recetas para los cambios más comunes, cómo verificar que no se rompió nada y
qué hacer cuando algo falla.

---

## Rutina para cualquier cambio

1. **Nunca directo en `main`**: un push a `main` publica en producción.
   ```bash
   git switch -c mi-cambio
   ```
2. Hacé el cambio y probalo: `npm run dev` (con Supabase) o `npm run dev:demo`.
3. ```bash
   npm run check
   ```
   (tipos + lint + tests). Tiene que dar verde.
4. Si tocaste la base: corré `supabase/schema.sql` en Supabase.
5. `git push -u origin mi-cambio` → abrí un pull request en GitHub → esperá
   que "Chequeos" quede en verde → **Merge** → se publica solo.

Para deshacer algo publicado: en GitHub, botón **Revert** del pull request
(crea otro PR que vuelve atrás).

---

## Modo demo (sin Supabase)

```bash
npm run dev:demo
```

http://localhost:5199/notas-app/ con un usuario fijo y 4 notas de ejemplo
(texto, gastos, peso y una en la papelera). Todo el código es el real salvo
los servicios, que se reemplazan por los de `demo/`. Al recargar, todo vuelve
al inicio.

Desde la consola del navegador (F12 → Console):

```js
__fake.offline = true                                  // simular sin internet
__fake.offline = false
__fake.remoteEdit("n1", { content: "<p>hola</p>" })    // edición desde "otro dispositivo"
__fake.notes                                           // lo que hay "en el servidor"
```

Sirve para probar autoguardado, errores y conflictos sin tocar datos reales.
**Si agregás una función a un archivo de `services/`, agregala también en
`demo/`.**

---

## Recetas

### Agregar un bloque al "+" y al "/"

1. `src/components/notes/blocks/blocks.ts` → nuevo objeto en `BLOCKS` (id
   único, label, ícono, keywords, si va en el "+", y `run`).
2. Ícono nuevo: `blocks/icons.tsx`.
3. Si es un **nodo nuevo** (como Fecha): crealo como `blocks/DateChip.tsx`
   (`parseHTML` / `renderHTML` definen cómo se guarda en el HTML), agregalo a
   las extensiones de `notes/Editor.tsx` **y** a `EXTENSIONS` en
   `blocks/blocks.test.ts`, y sumá un test de ida y vuelta.

### Agregar un campo a las notas

Ejemplo: `color`.
1. `supabase/schema.sql`: `alter table public.notes add column if not exists color text;` → correrlo en Supabase.
2. `src/types/index.ts`: agregarlo a `Note` (y a `NoteUpdate` si lo guarda el autoguardado).
3. `src/services/notes.service.ts`: sumarlo a `COLUMNS`; si se edita aparte, una función como `setPinned`.
4. `src/hooks/useNotes.ts`: la operación (como `togglePin`).
5. `demo/fake-notes.service.ts`: la misma función y el campo en las notas de ejemplo.
6. La pantalla que lo muestra/edita.
7. ¿Cambiarlo debe contar como "edición" (mover la nota arriba, cambiar la
   versión)? Si sí, agregalo a la condición del trigger `notes_before_update`.
8. `npm run check`.

### Agregar un tipo de nota

1. `src/types/index.ts`: sumarlo a `NoteKind` y definir su forma de datos.
2. `src/lib/<tipo>.ts`: `…Inicial`, `parse…`, `serialize…` (+ test como `gastos-peso.test.ts`).
3. `src/services/notes.service.ts`: `TITULO_INICIAL` y `contenidoInicial` (y lo mismo en `demo/`).
4. Editor propio en `components/notes/` y elegirlo en `NotePanel` (`NoteEditor.tsx`), dentro de un `<fieldset disabled={readOnly}>` para la papelera.
5. Entrada en el menú "+ Nueva" (`NoteList.tsx`), ícono en `NoteListItem.tsx`, export en `exportNote.ts` o `Workspace.handleExport`.
No hace falta tocar la base (`kind` es texto libre).

### Agregar un mensaje de error traducido

`src/utils/errors.ts` → `{ match: /texto en ingles/i, message: "En español." }`
en `RULES`. El error original aparece en la consola.

### Colores

`src/styles/theme.css`: `:root` (claro) y `[data-theme="dark"]`. En los
`.module.css` usá siempre `var(--color-…)`.

---

## Dependencias

```bash
npm outdated
npm audit --omit=dev   # solo lo que llega a la app publicada
```

| Paquete | Cuidado con |
|---|---|
| `@tiptap/*` | **Todos en la misma versión** (exigen versiones exactas entre sí). Si `npm install` da `ERESOLVE`, borrá `node_modules` y `package-lock.json` y volvé a instalar. Después: `npm test` (el test de bloques detecta cambios de formato). |
| `react` | La app usa React 18. Pasar a 19 es un cambio mayor. |
| `vite`, `@vitejs/plugin-react`, `vitest` | Actualizalos juntos. Vite 8 pide Node 20.19+. |

**Estado (nov 2026):** `npm audit --omit=dev` = **0 vulnerabilidades**.
Quedan 11 avisos moderados solo en herramientas de desarrollo (un
`minimatch` interno de ESLint), que no llegan a la app publicada.

---

## Solución de problemas

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| "Falta configurar Supabase" | No hay `.env` (local) o falta `.env.production` (build) | `cp .env.example .env` y completarlo. |
| "La base de datos está desactualizada…" | Se publicó la app sin correr el SQL | Correr `supabase/schema.sql` completo. |
| El link del email no vuelve a la app | Redirect URLs mal configuradas | Supabase → Authentication → URL Configuration (ver README). |
| "Sin conexión… Reintentar" que no se va | Sin internet, o el proyecto de Supabase se pausó (plan gratis) | Revisar internet / "Restore project" en Supabase. Los cambios siguen en memoria mientras no cierres la pestaña. |
| Aviso de conflicto | La misma nota se editó en dos lugares a la vez | Es lo esperado: elegí qué versión conservar. |
| Los cambios no llegan a otro dispositivo | Realtime no habilitado | Correr la sección 4 de `schema.sql`. La app igual recarga al volver a la pestaña. |
| "Algo salió mal" | Error de código | F12 → Console: el detalle está ahí. |
| El deploy falló | Ver GitHub → Actions → "Deploy a GitHub Pages" | Lo mismo debería fallar con `npm run build` local. |

---

## Pendientes conocidos / ideas

- **Funcionar sin internet de verdad**: `public/sw.js` hoy no guarda nada
  en caché (su respaldo offline nunca encuentra nada). Haría falta cachear
  los archivos de la app y guardar la cola de cambios en IndexedDB.
- **Imágenes huérfanas**: quitar una imagen editando la nota no la borra del
  Storage (solo se limpian al borrar la nota para siempre).
- **Papelera automática**: borrar notas con más de 30 días en la papelera
  (`pg_cron` en Supabase).
- **Miles de notas**: traer la lista sin `content` y el contenido al abrir.
- `pnpm-lock.yaml` / `pnpm-workspace.yaml` no se usan (deploy y CI usan npm): se pueden borrar.
