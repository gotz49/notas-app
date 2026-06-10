-- ============================================================
--  ESQUEMA DE LA BASE DE DATOS  (Supabase / PostgreSQL)
-- ============================================================
--  Como usarlo:
--  1. Entra a tu proyecto en Supabase.
--  2. Menu lateral -> "SQL Editor" -> "New query".
--  3. Pega TODO este archivo y presiona "Run".
--
--  Esto crea la tabla "notes" y activa la seguridad por fila (RLS),
--  que garantiza que cada usuario solo vea y edite SUS propias notas.
-- ============================================================

-- 1) Tabla de notas -----------------------------------------
create table if not exists public.notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  kind        text        not null default 'nota',
  title       text        not null default 'Sin titulo',
  content     text        not null default '',
  pinned      boolean     not null default false,
  keywords    text        not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Migracion: si ya tenias la tabla creada de antes, esto agrega las columnas
-- nuevas sin tocar tus datos. Es idempotente (si ya existen, no hace nada).
alter table public.notes
  add column if not exists pinned boolean not null default false;
alter table public.notes
  add column if not exists keywords text not null default '';
-- kind: tipo de nota. 'nota' = texto enriquecido (HTML en content);
-- 'gastos' = lista de gastos (JSON en content). Ver src/types/index.ts.
alter table public.notes
  add column if not exists kind text not null default 'nota';

-- Indice para listar rapido las notas de un usuario ordenadas por fecha
create index if not exists notes_user_id_updated_at_idx
  on public.notes (user_id, updated_at desc);

-- 2) Actualizar "updated_at" automaticamente en cada UPDATE ---
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- 3) Seguridad a nivel de fila (RLS) -------------------------
-- Sin esto, cualquiera con la anon key podria leer todas las notas.
alter table public.notes enable row level security;

-- Cada politica responde: "¿este usuario puede hacer esta operacion?"
-- auth.uid() = el id del usuario logueado en la peticion actual.

-- El "drop ... if exists" antes de cada una hace que el archivo se pueda
-- re-correr sin el error "policy already exists".

drop policy if exists "leer mis notas" on public.notes;
create policy "leer mis notas"
  on public.notes for select
  using (auth.uid() = user_id);

drop policy if exists "crear mis notas" on public.notes;
create policy "crear mis notas"
  on public.notes for insert
  with check (auth.uid() = user_id);

drop policy if exists "editar mis notas" on public.notes;
create policy "editar mis notas"
  on public.notes for update
  using (auth.uid() = user_id);

drop policy if exists "borrar mis notas" on public.notes;
create policy "borrar mis notas"
  on public.notes for delete
  using (auth.uid() = user_id);

-- 4) Realtime ------------------------------------------------
-- Habilita que la app reciba cambios en vivo (sincronizacion entre
-- dispositivos). Si la publicacion ya existe, ignora el error.
do $$
begin
  alter publication supabase_realtime add table public.notes;
exception
  when duplicate_object then null;
end $$;

-- 5) Storage de imagenes -------------------------------------
-- Las imagenes de las notas NO van en la base: se suben a este bucket y la
-- nota guarda solo su URL (la tabla "notes" queda liviana). El bucket es
-- PUBLICO para que el <img src="..."> de la nota funcione directo; las rutas
-- usan un UUID al azar (no adivinables). Escribir/borrar SI esta restringido
-- al dueno: cada usuario solo toca su propia carpeta "<user_id>/...".

insert into storage.buckets (id, name, public)
values ('imagenes', 'imagenes', true)
on conflict (id) do nothing;

-- Lectura: el bucket es publico, asi que cualquiera con la URL ve la imagen
-- (no hace falta politica de SELECT). Subir/actualizar/borrar: solo el dueno
-- de la carpeta. storage.foldername(name)[1] = primer segmento de la ruta.

drop policy if exists "subir mis imagenes" on storage.objects;
create policy "subir mis imagenes"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "actualizar mis imagenes" on storage.objects;
create policy "actualizar mis imagenes"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "borrar mis imagenes" on storage.objects;
create policy "borrar mis imagenes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'imagenes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
