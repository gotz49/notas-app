# Notas

App de notas personal con sincronizacion entre dispositivos. Escribis en
**Markdown**, se guarda solo y aparece al instante en cualquier dispositivo
donde inicies sesion.

**Stack:** React + TypeScript + Vite (frontend) · Supabase (base de datos,
auth y tiempo real).

---

## Como funciona (arquitectura)

La app esta separada en **capas**, de la mas cercana a la base de datos a la
mas cercana a la pantalla. Cada capa solo le habla a la de al lado:

```
   PANTALLA          components/   (lo que se ve: botones, formularios, editor)
      |
   ESTADO            hooks/        (la logica de React: que datos hay, como cambian)
      |
   LOGICA            services/     (las operaciones: login, crear/editar/borrar nota)
      |
   CONEXION          lib/          (el cliente unico que habla con Supabase)
      |
   BASE DE DATOS     Supabase (PostgreSQL)
```

Ventaja de esto: si manana cambias de Supabase a otra cosa, **solo tocas
`lib/` y `services/`**; los componentes y hooks quedan igual.

---

## Estructura de carpetas

```
src/
├─ types/        Tipos compartidos (la "forma" de los datos, ej: que es una Nota)
├─ lib/          supabase.ts  -> crea la conexion a Supabase una sola vez
├─ services/     Operaciones contra la base:
│                  auth.service.ts   -> login / registro / logout
│                  notes.service.ts  -> crear/leer/editar/borrar + realtime
├─ hooks/        Estado reutilizable de React:
│                  useAuth.ts   -> quien esta logueado
│                  useNotes.ts  -> las notas y como cambian (con sync en vivo)
├─ components/
│   ├─ ui/       Piezas genericas reutilizables (Button, Spinner)
│   ├─ auth/     LoginForm
│   └─ notes/    NoteList, NoteListItem, NoteEditor, MarkdownPreview
├─ styles/       global.css (reset + fuentes) y theme.css (colores/tipografias)
├─ App.tsx       Junta todo y decide que mostrar (login vs app)
└─ main.tsx      Punto de entrada (arranca React)

supabase/
└─ schema.sql    El SQL para crear la tabla y la seguridad en Supabase
```

### Convenciones
- **Componentes** en PascalCase (`NoteEditor.tsx`), uno por archivo.
- **Estilos** con CSS Modules (`NoteEditor.module.css`): las clases no chocan
  entre componentes.
- **Componentes "tontos"** (ej. `NoteListItem`) solo muestran datos y avisan
  eventos; la logica vive en el padre o en los hooks. Esto los hace reutilizables.

---

## Puesta en marcha

### 1. Requisitos
- Node.js 18 o superior (incluye `npm`). Descarga: https://nodejs.org

### 2. Instalar dependencias
```bash
npm install
```

### 3. Crear el proyecto en Supabase
1. Crea una cuenta y un proyecto nuevo en https://supabase.com
2. En el menu **SQL Editor**, pega el contenido de `supabase/schema.sql` y dale **Run**.
3. En **Settings -> API** copia el **Project URL** y la **anon public key**.

### 4. Configurar las claves
```bash
cp .env.example .env
```
Edita `.env` y pega tu URL y tu anon key. (El archivo `.env` NO se sube a
GitHub: ya esta en `.gitignore`.)

### 5. Correr en desarrollo
```bash
npm run dev
```
Abri la URL que muestra (normalmente http://localhost:5173). Registrate,
confirma tu email y empeza a escribir.

---

## Comandos
| Comando           | Que hace                                  |
|-------------------|-------------------------------------------|
| `npm run dev`     | Servidor de desarrollo con recarga en vivo|
| `npm run build`   | Compila la version de produccion en `dist`|
| `npm run preview` | Previsualiza la build de produccion       |
