# Funcionalidades

Todo lo que la app hace, contado desde el punto de vista de quien la usa. Al
lado, el archivo principal (detalle en [MAPA_DE_ARCHIVOS.md](MAPA_DE_ARCHIVOS.md)).

---

## 1. Cuenta

| Función | Cómo se usa | Dónde vive |
|---|---|---|
| Crear cuenta | "¿No tenés cuenta? Crear una" → email + contraseña (mín. 8). Llega un email de confirmación. | `auth/LoginForm.tsx`, `services/auth.service.ts` |
| Entrar | Email + contraseña → Enter o "Entrar". Es un formulario real: el navegador puede recordar la contraseña. | ídem |
| Recuperar contraseña | "¿Olvidaste tu contraseña?" → email → link → la app pide la contraseña nueva dos veces. | `LoginForm.tsx`, `NewPasswordForm.tsx`, `hooks/useAuth.ts` |
| Errores claros | "Email o contraseña incorrectos", "Sin conexión…", etc., en español. | `utils/errors.ts` |
| Salir | "Salir" abajo a la izquierda. Antes guarda lo pendiente; si algo no se pudo guardar, pregunta. | `Workspace.tsx` |

## 2. Tipos de nota

| Tipo | Qué es | Editor |
|---|---|---|
| 📝 **Nota** | Texto enriquecido con bloques, imágenes y panel de keywords. | `notes/Editor.tsx` |
| 💲 **Lista de gastos** | Varias listas con ✓ pagado · concepto · monto, subtotales y total general. | `notes/GastosEditor.tsx` |
| ⚖️ **Registro de peso** | Un peso por fecha; listado editable. Se exporta como imagen con gráfico. | `notes/PesoEditor.tsx` |

Se crean con **+ Nueva** y el tipo no cambia después.

## 3. Lista de notas (barra lateral)

| Función | Detalle | Dónde vive |
|---|---|---|
| Orden | Fijadas arriba; después por última edición. Fijar o mandar a la papelera no cuenta como edición. | `utils/notes.ts` |
| Buscar | Por título, contenido **y keywords**, sin importar mayúsculas ni tildes. | `utils/notes.ts`, `NoteList.tsx` |
| Pestañas **Notas / Papelera (N)** | La papelera muestra cuándo se borró cada nota. | `NoteList.tsx` |
| Clic derecho | Menú de acciones de esa nota (no en la papelera). | `NoteActionsMenu.tsx` |
| Colapsar | « / » para esconder la barra (desktop), recordado entre sesiones. | `NoteList.tsx` |
| Tema | Botón "Cambiar tema" (claro / oscuro), recordado entre sesiones. | `ui/ThemeToggle.tsx`, `hooks/useTheme.ts` |

## 4. Editor de texto

| Función | Cómo se usa |
|---|---|
| Formato en vivo | Atajos Markdown al tipear (`# `, `- `, `**…**`, `---`…) y de teclado (ver "Atajos"). |
| Menú de formato | Clic derecho (desktop) o botón **Aa** (móvil): negrita, cursiva, tachado, títulos, listas, checklist, cita, código, divisor, imagen, tabla (filas/columnas), limpiar formato, copiar/pegar. |
| Bloques | Botón **+** o escribir **/**: viñetas, checklist, código, fecha, divisor, desplegable, títulos, numerada, cita; con / además texto, tabla e imagen. |
| Fecha / Desplegable | Pastillas dentro del texto; click para cambiar la fecha o elegir/editar opciones. |
| Imágenes | Pegar, arrastrar o "Insertar imagen…". Se comprimen y suben a Storage. |
| Keywords | Panel a la derecha (desktop) o desde el menú (móvil) para definiciones/aclaraciones. |

## 5. Guardado automático

| Función | Detalle |
|---|---|
| Autoguardado | ~0,6 s después de dejar de escribir (título, texto, keywords, gastos, peso). |
| Estado visible | En la barra: "Guardando…", "Guardado ✓" (un instante) o el **error con "Reintentar"**. |
| Sin internet | No se pierde nada: los cambios quedan en memoria y se reintenta solo (2 s → 30 s) y en cuanto vuelve la conexión. |
| Cambiar de nota / app en segundo plano | Lo pendiente se guarda igual. |
| Cerrar la pestaña | Se guarda ya; si quedó algo sin guardar, el navegador pregunta "¿Salir del sitio?". |

Dónde vive: `utils/autosaveQueue.ts`, `hooks/useAutosave.ts`, `NoteEditor.tsx`.

## 6. Sincronización entre dispositivos

| Función | Detalle |
|---|---|
| En vivo | Lo que cambiás en un dispositivo aparece en los otros en segundos. |
| Nota abierta en dos lugares | Si cambia en otro dispositivo y acá no estás escribiendo, se actualiza sola. |
| **Conflictos** | Si se edita en los dos a la vez, **no se pisa nada**: aviso para elegir "Usar la otra versión" o "Quedarme con la mía". |
| Reconexión | Al volver a la pestaña, recuperar internet o reconectarse, la lista se recarga. |

Dónde vive: `services/notes.service.ts`, `hooks/useNotes.ts`, `NoteEditor.tsx`.

## 7. Organizar

| Función | Cómo se usa |
|---|---|
| Fijar | ☰ o clic derecho → Fijar / Quitar. |
| **Papelera** | ☰ o clic derecho → **Mover a la papelera** → aviso con **Deshacer**. |
| Restaurar | Pestaña Papelera → abrir la nota (se ve en solo lectura) → **Restaurar**. |
| Borrar para siempre | Desde la nota en la papelera, con confirmación. Borra también sus imágenes. |
| Vaciar papelera | Botón abajo de la lista en la pestaña Papelera, con confirmación. |
| Exportar | ☰ → Exportar: nota → `.txt`, gastos → `.xls`, peso → imagen PNG con gráfico y rango de fechas. |
| Atajos | ☰ → Atajos: lista de atajos de teclado. |

## 8. Pantalla y app

| Función | Detalle |
|---|---|
| Celular | Un panel a la vez (lista o nota), "← Notas" para volver, y el gesto/botón "atrás" de Android vuelve a la lista en vez de cerrar la app. |
| Instalable (PWA) | "Agregar a la pantalla de inicio". (Hoy necesita internet: el service worker no guarda copia local.) |
| Errores inesperados | "Algo salió mal" + Recargar en vez de pantalla en blanco. |
| Falta configuración | "Falta configurar Supabase" con instrucciones. |

## 9. Seguridad (lo que no se ve)

- Cada usuario solo ve y modifica **sus** notas e imágenes (RLS en la base).
- Nadie puede cambiar el dueño, el tipo ni la fecha de creación de una nota.
- El HTML peligroso (`<script>`, `onerror`, links `javascript:`) se descarta.
- Límites: 500 caracteres de título y 1.000.000 de contenido.
