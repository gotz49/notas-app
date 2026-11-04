# Arquitectura

Cómo está armada la app y cómo se hablan sus partes. Qué hace cada archivo:
[MAPA_DE_ARCHIVOS.md](MAPA_DE_ARCHIVOS.md).

---

## 1. Capas

Cada capa solo le habla a la de al lado:

```
 PANTALLA     components/   Lo que se ve. No saben nada de Supabase.
     │        Workspace.tsx (pantalla principal), App.tsx (elige pantalla)
     ▼
 ESTADO       hooks/        useNotes (lista + realtime + operaciones),
     │                      useAutosave (cola de guardado), useAuth, useTheme
     ▼
 LÓGICA PURA  utils/        Sin React ni Supabase, con tests:
     │  lib/gastos, peso    autosaveQueue, notes (versiones, orden, búsqueda),
     │                      errors (mensajes en español), helpers de gastos/peso
     ▼
 OPERACIONES  services/     notes.service (CRUD, papelera, realtime),
     │                      images.service (Storage), auth.service (login)
     ▼
 CONEXIÓN     lib/supabase.ts   El único cliente de Supabase.
     ▼
 BASE         Supabase      PostgreSQL + Auth + Realtime + Storage (supabase/schema.sql)
```

`types/index.ts` tiene la forma de los datos (`Note`, `NoteUpdate`, gastos,
peso) que usan todas las capas. `styles/` tiene los colores (claro/oscuro).

---

## 2. Árbol de componentes

```
main.tsx
├─ MissingConfig            (si faltan las claves de Supabase)
└─ ErrorBoundary            (si algo explota: "Algo salió mal" + Recargar)
   └─ App                   (elige pantalla según la sesión: useAuth)
      ├─ Spinner
      ├─ NewPasswordForm    (vino del link "recuperar contraseña")
      ├─ LoginForm          (sin sesión)
      └─ Workspace key={user.id}         ← useNotes · useAutosave · useToast
         ├─ div.app  (SOLO estos dos hijos: el CSS móvil depende de eso)
         │  ├─ NoteList                  (buscar, pestañas Notas/Papelera, lista)
         │  │  ├─ NoteListItem ×N
         │  │  └─ NoteActionsMenu        (clic derecho)
         │  └─ NoteEditor                (versiones remotas, avisos papelera/conflicto)
         │     └─ NotePanel key="id:revision"   (una nota)
         │        ├─ barra: ← Notas · SaveIndicator · + · Aa · ☰ (NoteActionsMenu)
         │        ├─ título
         │        ├─ Editor (texto) | GastosEditor | PesoEditor
         │        │    Editor → bloques (+, /), menú de formato, imágenes
         │        └─ panel de keywords (solo texto)
         ├─ ShortcutsHelp            (modal de atajos)
         ├─ PesoExportDialog         (exportar peso como imagen)
         └─ Toast                    ("Movida a la papelera · Deshacer", errores)
```

Dos `key` importantes:
- **`Workspace key={user.id}`**: si cambia el usuario se destruye todo, así
  nunca quedan en pantalla ni en memoria notas de la cuenta anterior.
- **`NotePanel key="id:revision"`**: un editor nuevo por nota (y cuando se
  adopta una versión que llegó de otro dispositivo). Reinicia título,
  keywords y el historial de deshacer.

---

## 3. Quién maneja cada dato

| Dato | Dónde vive | Quién lo cambia |
|---|---|---|
| Usuario logueado | `useAuth` (App) | Supabase Auth (`onAuthStateChange`) |
| Lista de notas (lo que hay en el servidor) | `useNotes` (Workspace) | Carga, Realtime y operaciones |
| Cambios sin guardar, versiones, estado del guardado | `AutosaveQueue` (dentro de `useAutosave`, Workspace) | El editor y la propia cola |
| Nota abierta, pestaña, panel móvil, keywords visibles, modales | `useState` en Workspace | Lista / menús |
| Texto de búsqueda | `useState` en NoteList | El buscador |
| Título y keywords mientras se escriben | `useState` en NotePanel | Los inputs |
| Documento | TipTap (Editor) o estado de Gastos/PesoEditor | El usuario |

---

## 4. Flujos

### 4.1 Arranque

```
main.tsx ─ ¿hay claves? ─ no ─► MissingConfig
              │ sí
              ▼
App ─ useAuth ─► onAuthStateChange (INITIAL_SESSION)
   ¿user? ─ no ─► LoginForm ── signIn() ──► SIGNED_IN ─┐
      │ sí ◄─────────────────────────────────────────────┘
      ▼
Workspace key={user.id}
   useNotes: fetchNotes()  +  subscribeToNotes(user.id)
```

### 4.2 Escribir y guardar (autoguardado)

```
 tecla (título, editor, keywords, gastos, peso)
   ▼
 NotePanel ──► autosave.queue.queue(noteId, { content })   estado "pending" → "Guardando…"
                 │ espera 600 ms sin teclear (debounce)
                 ▼
               queue.flush() ── save(id, cambios, versionBase)        estado "saving"
                 ▼
               useNotes.save ──► notes.service.saveNote
                                   UPDATE … WHERE id = ? AND updated_at = versionBase
   ┌─ OK ───────────► versionBase = nuevo updated_at      → "Guardado ✓" (un instante)
   ├─ error de red ─► los cambios vuelven a la cola        → error + "Reintentar"
   │                  reintento en 2 s, 4 s, 8 s… (máx. 30 s) y al volver internet
   └─ 0 filas ─────► NoteConflictError                     → aviso de conflicto
```

Garantías (`utils/autosaveQueue.ts`, con tests):
- una pila de cambios **por nota**: cambiar de nota no pierde nada;
- **de a un guardado** por vez: una respuesta vieja no puede pisar a una nueva;
- si falla y mientras tanto se escribió más, se combinan (lo último gana);
- al ocultar/cerrar la pestaña se guarda ya; si quedó algo sin guardar, el
  navegador pregunta antes de cerrar (`hooks/useAutosave.ts`).

### 4.3 Sincronización y conflictos

**La versión de una nota es su `updated_at`.** La base lo cambia solo cuando
cambia el título, el contenido o las keywords (trigger en
[BASE_DE_DATOS.md](BASE_DE_DATOS.md)).

```
 Dispositivo B guarda ─► Postgres ─► Realtime ─► Dispositivo A
                                                   ▼
                       useNotes: applyRemoteChange()  (ignora versiones más viejas)
                                                   ▼
                       NoteEditor, si es la nota abierta:
                       ┌─ A sin cambios pendientes → adopta la versión (revision+1,
                       │                              NotePanel se monta de nuevo)
                       └─ A con cambios pendientes → no toca nada. Al guardar, el UPDATE
                                                     no afecta filas → conflicto → A elige:
                                                       · "Usar la otra versión"
                                                       · "Quedarme con la mía" (guarda sin
                                                         chequear versión: pisa la de B)
```

Es "control de concurrencia optimista": simple y sin bloquear notas. En una
app personal los conflictos reales son raros, pero cuando pasan **nunca se
pierde texto sin que el usuario lo decida**.

**Respaldo del realtime:** el websocket se corta con la pestaña en segundo
plano o el equipo suspendido. `useNotes` recarga todo al reconectarse el
canal, al volver a la pestaña y al recuperar internet.

### 4.4 Papelera

```
 ☰ / clic derecho → "Mover a la papelera" ─► Workspace.handleTrash
     1. queue.flush()         (guardar lo último)
     2. cerrar la nota
     3. useNotes.trash(id)    → UPDATE deleted_at = ahora   (no cambia updated_at)
     4. Toast "Nota movida a la papelera · Deshacer"
 Pestaña Papelera → abrir nota (solo lectura) → Restaurar | Borrar para siempre
 Borrar para siempre / Vaciar papelera → confirm() → DELETE + limpiar imágenes del Storage
```

Las operaciones de `useNotes` son **optimistas**: cambian la pantalla ya y,
si el servidor falla, vuelven atrás y Workspace muestra un aviso.

### 4.5 Imágenes

```
 pegar / arrastrar / "Insertar imagen…" en Editor
   ▼ onUploadImage(file) ─► useNotes.uploadImage ─► images.service.uploadNoteImage
        comprimir a WebP (canvas) → subir a Storage "imagenes/<user_id>/<uuid>.webp"
   ▼ URL pública → <img src="…"> dentro del HTML de la nota
```

### 4.6 Login y recuperación de contraseña

- Registro → email de confirmación → vuelve a `origin + /notas-app/`.
- "¿Olvidaste tu contraseña?" → email → al abrir el link Supabase emite
  `PASSWORD_RECOVERY` → `useAuth` lo detecta → App muestra `NewPasswordForm`.
- Salir: Workspace guarda lo pendiente; si algo no se pudo guardar, pregunta.

---

## 5. Decisiones de diseño

| Decisión | Por qué |
|---|---|
| Notas de texto en HTML | Así guarda TipTap sin conversiones; las imágenes son `<img src>`. `blocks.test.ts` protege el formato. |
| Gastos y peso como JSON en `content` | Un solo modelo de tabla; sumar un tipo de nota no requiere migración (`kind`). |
| Cola de autoguardado como clase sin React | Se testea sola con relojes falsos; React solo la "mira" (`useSyncExternalStore`). |
| `updated_at` como versión, manejado por trigger | El servidor decide la versión (los relojes de los dispositivos pueden estar mal). |
| Realtime incremental + recarga en reconexión | Antes cada guardado recargaba todas las notas; ahora solo viaja la nota que cambió. |
| Papelera con `deleted_at` | Borrar por error deja de ser irreversible. |
| `Workspace key={user.id}` | La forma más simple y segura de no mezclar cuentas. |
| Errores traducidos en un solo lugar (`utils/errors.ts`) | Mensajes consistentes; el detalle técnico queda en la consola. |
