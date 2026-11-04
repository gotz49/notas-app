# Notas

App de notas personal con sincronización entre dispositivos e instalable
como app (PWA). Tres tipos de nota: **texto enriquecido** (con bloques,
imágenes y keywords), **listas de gastos** y **registro de peso**. Se guarda
solo y aparece al instante en cualquier dispositivo donde inicies sesión.

**Producción:** https://gotz49.github.io/notas-app/ — cada push a `main` se
publica automáticamente (GitHub Actions → GitHub Pages).

**Stack:** React + TypeScript + Vite · TipTap 3 (editor) · Supabase
(PostgreSQL, login, tiempo real y almacenamiento de imágenes).

---

## Documentación

| Documento | Para qué sirve |
|---|---|
| [PROYECTO.md](PROYECTO.md) | Resumen para ponerse al día rápido |
| [docs/FUNCIONALIDADES.md](docs/FUNCIONALIDADES.md) | Todo lo que la app hace, desde el punto de vista del usuario |
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Cómo se conectan las partes: capas, flujo de datos, autoguardado, sincronización y conflictos |
| [docs/MAPA_DE_ARCHIVOS.md](docs/MAPA_DE_ARCHIVOS.md) | Qué hace cada archivo y cuál tocar para cada cambio |
| [docs/BASE_DE_DATOS.md](docs/BASE_DE_DATOS.md) | Tabla, seguridad (RLS), trigger, Storage, tiempo real y cómo actualizar la base |
| [docs/MANTENIMIENTO.md](docs/MANTENIMIENTO.md) | Recetas paso a paso, publicar, dependencias y solución de problemas |
| [docs/CAMBIOS.md](docs/CAMBIOS.md) | Registro de cambios |
| [CLAUDE.md](CLAUDE.md) | Guía técnica breve (para Claude Code y para humanos apurados) |

Si es la primera vez que mirás el código: **PROYECTO → ARQUITECTURA → MAPA_DE_ARCHIVOS**.

---

## Puesta en marcha (desarrollo)

### 1. Requisitos
- **Node.js 20.19 o superior** (recomendado 22, ver `.nvmrc`). Descarga: https://nodejs.org
  - **Sin permisos de administrador:** bajá el `.zip` de Windows desde
    https://nodejs.org/dist/, descomprimilo en `%LOCALAPPDATA%\nodejs-portable`
    y agregá la carpeta que contiene `node.exe` al PATH de tu usuario.

### 2. Instalar dependencias
```bash
npm install
```

### 3. Supabase
1. Proyecto en https://supabase.com.
2. **SQL Editor** → pegá **todo** `supabase/schema.sql` → **Run**. Es
   idempotente: se puede volver a correr para actualizar una base existente
   sin perder notas.
3. **Authentication → URL Configuration**:
   - **Site URL:** `https://gotz49.github.io/notas-app/`
   - **Redirect URLs:** esa misma y `http://localhost:5173/notas-app/`.
     Sin esto, los links de "confirmar email" y "recuperar contraseña" no
     vuelven a la app.

### 4. Claves
```bash
cp .env.example .env
```
Completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (Settings → API). El
`.env` no se sube a git. (Producción usa `.env.production`, que sí está
versionado porque esas claves son públicas por diseño: la seguridad la da RLS.)

### 5. Correr
```bash
npm run dev
```
Abrí http://localhost:5173/notas-app/.

**¿Probar la interfaz sin Supabase?** `npm run dev:demo` (datos falsos en
memoria) → http://localhost:5199/notas-app/. Ver
[docs/MANTENIMIENTO.md](docs/MANTENIMIENTO.md#modo-demo-sin-supabase).

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en vivo |
| `npm run dev:demo` | Igual, con backend falso (sin Supabase ni `.env`) |
| `npm run build` | Revisa tipos y compila la versión de producción en `dist/` |
| `npm run preview` | Previsualiza la build de producción |
| `npm run check` | Tipos + lint + tests. **Correlo antes de cada commit.** |
| `npm test` / `npm run test:watch` | Tests (Vitest) |
| `npm run lint` | ESLint |

## Cómo se publica

- `main` = producción. Cada push a `main` corre `.github/workflows/deploy.yml`
  y publica en GitHub Pages en un par de minutos.
- Trabajá en una rama y abrí un pull request: `.github/workflows/ci.yml` corre
  los chequeos (tipos, lint, tests, build) **sin publicar**. Mezclá a `main`
  cuando esté en verde.
- Si el cambio toca la base de datos, corré `supabase/schema.sql` en Supabase
  **antes** de mezclar.
