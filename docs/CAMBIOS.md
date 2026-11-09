# Registro de cambios

## 0.3.0 — 2026-11-09 · Gastos mensuales

Las notas de gastos pasan a ser una hoja de **gastos del mes**. Todo se guarda
en el mismo JSON de `content`: **no hay que tocar Supabase** (ni `schema.sql`
ni los servicios). Las notas existentes se abren igual y sus totales no cambian.

- **Mes de la nota** (`‹ Noviembre 2026 ›`) y **resumen**: ingresos · gastos ·
  saldo · falta pagar. El total de abajo pasa a ser el **saldo** (ingresos −
  gastos): lo que antes daba `-140` ahora se ve como `140,00` en verde.
- **Menú ⋯ por renglón**: gasto o **ingreso** (se carga en positivo), **cuota**
  (5 de 12), **solo este mes**, **US$** con cotización del mes.
- **Día de vencimiento por lista**, con aviso desde 5 días antes si falta pagar algo.
- **Cerrar mes**: muestra qué va a pasar, guarda un resumen en el **historial**,
  destilda, avanza cuotas, borra las terminadas y las de "solo este mes" y pasa
  al mes siguiente. Se puede **deshacer**.
- **Historial**: gráfico de ingresos vs gastos (12 meses), tabla con detalle por
  lista, y cada lista muestra la diferencia contra el último mes cerrado.
- **Convertir formato viejo**: un aviso ofrece pasar "Pixel 5/12" a cuota y los
  montos negativos a ingresos (sin cambiar los totales).
- Export `.xls` con cuota, US$, resumen e historial.
- *`lib/gastos.ts` (+ `gastos-mes.test.ts`), `types/index.ts`,
  `components/notes/GastosEditor.tsx`, `components/notes/gastos/`, `exportNote.ts`.*

## 0.2.0 — 2026-11-04 · Guardado confiable, conflictos, papelera y mantenibilidad

Resultado de una revisión de funcionalidad, seguridad y buenas prácticas,
aplicada sobre el código de producción. Cada punto dice **qué pasaba**,
**qué se hizo** y **dónde**.

> **Para publicar:** correr `supabase/schema.sql` completo en Supabase
> **antes** de mezclar a `main` (la app nueva necesita la columna
> `deleted_at`; la app vieja funciona igual con la base nueva). Agregar
> `https://gotz49.github.io/notas-app/` en Supabase → Authentication →
> URL Configuration → Redirect URLs (para recuperar contraseña).

### 🔴 Guardado y datos

1. **Los errores al guardar no se veían.** Si fallaba (sin internet, Supabase
   caído), el indicador quedaba en "Guardando…" para siempre y el cambio se
   perdía al cerrar.
   → Cola de autoguardado con **reintentos** (2 s → 30 s, y al volver
   internet), error visible con **Reintentar**, y aviso del navegador si
   cerrás con cambios sin guardar.
   *`utils/autosaveQueue.ts` (+ tests), `hooks/useAutosave.ts`, `NoteEditor.tsx`.*

2. **Editar en dos dispositivos pisaba cambios sin aviso** (el último en guardar ganaba).
   → Cada guardado lleva la versión (`updated_at`) sobre la que se escribió;
   si cambió en el medio, no se pisa nada y aparece **"Usar la otra versión /
   Quedarme con la mía"**. Si la nota abierta cambia en otro dispositivo y no
   estás escribiendo, se actualiza sola.
   *`services/notes.service.ts` (`saveNote`), `NoteEditor.tsx`, trigger en `schema.sql`.*

3. **Borrar era definitivo** (y borraba las imágenes del Storage al instante).
   → **Papelera** (`deleted_at`): mover con **Deshacer**, restaurar, borrar
   para siempre y vaciar (con confirmación). Las imágenes se limpian recién
   al borrar para siempre. En la papelera las notas son de solo lectura.
   *`schema.sql`, `notes.service.ts`, `useNotes.ts`, `Workspace.tsx`, `NoteList.tsx`, `NoteEditor.tsx`, `NoteActionsMenu.tsx`.*

4. **Abrir una nota podía disparar un guardado** (normalización de TipTap) → solo
   se avisa si el HTML cambió de verdad. *`Editor.tsx`.*

### 🟠 Sincronización y robustez

5. **Realtime recargaba TODAS las notas en cada guardado.**
   → Cada cambio se aplica directo a la lista, ignorando "ecos" viejos que
   lleguen tarde; filtro por usuario. Recarga completa solo al reconectar,
   volver a la pestaña o recuperar internet.
   *`notes.service.ts`, `useNotes.ts`, `utils/notes.ts` (+ tests).*

6. **Al cambiar de cuenta en el mismo equipo podían verse notas de la anterior.**
   → La pantalla principal se separó en `Workspace.tsx`, que `App` monta con
   `key={user.id}`.

7. **Si fallaba la carga inicial, el spinner giraba para siempre** → pantalla
   de error con "Reintentar". Las operaciones (fijar, papelera…) vuelven atrás
   y avisan si el servidor falla. *`useNotes.ts`, `Workspace.tsx`.*

8. **Layout móvil frágil**: el CSS elige el panel con `:first-child` /
   `:last-child`, y el panel de atajos/export quedaba como último hijo. → Los
   modales y avisos van fuera del contenedor. *`Workspace.tsx`.*

### 🟡 Seguridad

9. **Dependencias**: TipTap 3.23–3.25 tenía la vulnerabilidad GHSA-cp6q-959q-f8rh;
   Vite 5 traía un esbuild vulnerable en el servidor de desarrollo.
   → TipTap **3.32.2**, Vite 8, Vitest 5. `npm audit --omit=dev` = **0**.
   Se regeneró `package-lock.json` (los subpaquetes de TipTap estaban clavados en 3.25).

10. **Base de datos** (`schema.sql`, sigue siendo idempotente):
    - trigger que impide cambiar `id`, `user_id`, `kind` y `created_at` desde el navegador;
    - `updated_at` solo cambia con título, contenido o keywords;
    - políticas con `with check` en update, `to authenticated` y `(select auth.uid())`;
    - `with check` también en la política de actualizar imágenes;
    - límites de tamaño (título 500, contenido 1.000.000) y `search_path` fijo en la función.

### 🔵 Funcionalidad

11. **Login**:
    - formulario real (Enter y gestores de contraseñas);
    - **recuperar contraseña**;
    - errores en español;
    - mensaje de éxito en verde (antes salía en rojo, como error);
    - mínimo de 8 caracteres;
    - los links del email vuelven a `/notas-app/`.
    *`LoginForm.tsx`, `NewPasswordForm.tsx`, `useAuth.ts`, `auth.service.ts`, `utils/errors.ts`.*
12. **Búsqueda** sin tildes y también en las keywords. *`utils/notes.ts`.*
13. **Orden correcto con Realtime**: fijadas arriba y después por última edición, calculado en pantalla.
14. Pantallas **"Algo salió mal"** (en vez de blanco) y **"Falta configurar Supabase"**. *`ui/ErrorBoundary.tsx`, `ui/MissingConfig.tsx`, `main.tsx`.*
15. Botón "Salir" sin estilos en línea; textos con tildes en la lista ("No tenés notas todavía").

### ⚙️ Mantenibilidad

16. **Tests** (Vitest, 43): autoguardado, sincronización, búsqueda, HTML de
    ida y vuelta de los bloques (Fecha, Desplegable, checklist, links,
    imágenes), seguridad del contenido, gastos y peso.
17. **ESLint** (`npm run lint`) y `npm run check`.
18. **CI** (`.github/workflows/ci.yml`): chequeos en cada push/PR, sin publicar.
19. **Modo demo** (`npm run dev:demo`) para probar la interfaz sin Supabase.
20. Variables de entorno tipadas (`vite-env.d.ts`), `.nvmrc`, `.editorconfig`, TypeScript a ES2022.
21. **Documentación**: `docs/` (funcionalidades, arquitectura, mapa de archivos,
    base de datos, mantenimiento, cambios), README actualizado (hablaba de
    Markdown y de `MarkdownPreview`), `PROYECTO.md` y `CLAUDE.md` al día.

### Qué se verificó

- `npm run check` (tipos + lint + 43 tests) y `npm run build`: en verde.
- En el navegador (modo demo), desktop y celular:
  - abrir una nota sin que se guarde nada;
  - autoguardado;
  - sin conexión → error → otro dispositivo edita → conflicto → las dos opciones;
  - edición remota con la nota abierta;
  - papelera + Deshacer;
  - solo lectura en la papelera (texto y gastos);
  - restaurar y borrar para siempre;
  - edición de gastos y orden de la lista.
- **No verificado contra el Supabase real**: correr el SQL, login,
  recuperación de contraseña, Realtime entre dos dispositivos, subir imágenes.

---

## 0.1.0 — mayo/junio 2026

Versión inicial y features: editor enriquecido, bloques estilo Claude Docs,
imágenes en Storage, notas de gastos y de peso, keywords, PWA, modo oscuro,
deploy a GitHub Pages.
