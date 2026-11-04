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
--
--  Es IDEMPOTENTE: se puede correr las veces que quieras, sobre una
--  base nueva o sobre una existente (agrega lo que falta sin borrar
--  notas). Detalle de cada parte: docs/BASE_DE_DATOS.md
--  Si cambias columnas, actualiza tambien src/types/index.ts (Note)
--  y la lista COLUMNS de src/services/notes.service.ts.
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
-- 'gastos' = lista de gastos (JSON); 'peso' = registros de peso (JSON).
-- Es texto libre (sin CHECK), asi que sumar tipos nuevos NO requiere migracion.
-- Ver src/types/index.ts.
alter table public.notes
  add column if not exists kind text not null default 'nota';
-- deleted_at: papelera. null = nota normal; con fecha = esta en la papelera
-- desde ese momento (se puede restaurar). Solo "Borrar para siempre" hace
-- un DELETE de verdad.
alter table public.notes
  add column if not exists deleted_at timestamptz;

-- Indice para listar rapido las notas de un usuario ordenadas por fecha
create index if not exists notes_user_id_updated_at_idx
  on public.notes (user_id, updated_at desc);

-- Limites de tamano: evitan que una nota gigante (por error o abuso) llene
-- la base. "not valid" = no revisa las notas que ya existen, solo las
-- escrituras nuevas, asi este script nunca falla por datos viejos.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_title_length') then
    alter table public.notes
      add constraint notes_title_length check (char_length(title) <= 500) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'notes_content_length') then
    alter table public.notes
      add constraint notes_content_length check (char_length(content) <= 1000000) not valid;
  end if;
end $$;

-- 2) Trigger antes de cada UPDATE ------------------------------
--  a) Protege campos que la app nunca debe cambiar: id, user_id, kind y
--     created_at. Aunque alguien mande otro valor desde el navegador, se
--     conserva el original (nadie puede "regalar" una nota a otro usuario).
--  b) "updated_at" cambia SOLO si cambio el titulo, el contenido o las
--     keywords. Fijar o mandar a la papelera NO cuenta como edicion: no
--     mueve la nota en la lista ni genera falsos conflictos. La app usa
--     updated_at como "numero de version" para detectar si otro
--     dispositivo edito la nota mientras tanto (ver docs/ARQUITECTURA.md).
create or replace function public.notes_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id         := old.id;
  new.user_id    := old.user_id;
  new.kind       := old.kind;
  new.created_at := old.created_at;

  if new.title    is distinct from old.title
  or new.content  is distinct from old.content
  or new.keywords is distinct from old.keywords then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;

  return new;
end;
$$;

-- Reemplaza el trigger anterior (que cambiaba updated_at en CUALQUIER update).
drop trigger if exists notes_set_updated_at on public.notes;
drop function if exists public.set_updated_at();

drop trigger if exists notes_before_update on public.notes;
create trigger notes_before_update
  before update on public.notes
  for each row execute function public.notes_before_update();

-- 3) Seguridad a nivel de fila (RLS) -------------------------
-- Sin esto, cualquiera con la anon key podria leer todas las notas.
alter table public.notes enable row level security;

-- Cada politica responde: "¿este usuario puede hacer esta operacion?"
--  - auth.uid() = el id del usuario logueado en la peticion actual.
--  - "(select auth.uid())" en vez de "auth.uid()": Postgres lo calcula una
--    vez por consulta y no una vez por fila (recomendacion de Supabase).
--  - "to authenticated": un visitante sin sesion (rol "anon") no ve nada.

-- El "drop ... if exists" antes de cada una hace que el archivo se pueda
-- re-correr sin el error "policy already exists".

drop policy if exists "leer mis notas" on public.notes;
create policy "leer mis notas"
  on public.notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "crear mis notas" on public.notes;
create policy "crear mis notas"
  on public.notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- "using" = que filas puedo tocar; "with check" = como deben quedar.
drop policy if exists "editar mis notas" on public.notes;
create policy "editar mis notas"
  on public.notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "borrar mis notas" on public.notes;
create policy "borrar mis notas"
  on public.notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4) Realtime ------------------------------------------------
-- Habilita que la app reciba cambios en vivo (sincronizacion entre
-- dispositivos). Si la publicacion ya existe, ignora el error.
-- Realtime respeta RLS: cada usuario solo recibe cambios de SUS notas.
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
  )
  with check (
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
