-- ============================================================================
-- Migración: Cuenta núcleo + perfiles por deporte (fútbol / pádel)
-- ============================================================================
-- Cómo aplicarla:
--   1. Revisa primero en el Dashboard de Supabase (Database > Functions/Triggers)
--      si ya existe un trigger que crea una fila en `perfiles` al registrarse
--      un usuario nuevo (probablemente se llama algo como on_auth_user_created /
--      handle_new_user). Anota su nombre: lo vamos a reemplazar al final de
--      este archivo.
--   2. Haz un respaldo de tu base (Database > Backups, o pg_dump) antes de
--      correr esto en producción.
--   3. Corre este archivo completo en el SQL Editor de Supabase.
--   4. A partir de ahora, versiona aquí (supabase/migrations/) cualquier
--      cambio futuro de esquema en lugar de hacerlo solo desde el dashboard.
-- ============================================================================


-- 1) CUENTA NÚCLEO ------------------------------------------------------------
-- Una fila por usuario de auth.users. Aquí vive lo que es de la PERSONA,
-- no de un deporte en particular: nombre, correo, teléfono, avatar del hub.
create table if not exists public.cuentas (
  id         uuid primary key references auth.users(id) on delete cascade,
  correo     text,
  nombre     text,
  telefono   text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.cuentas enable row level security;

drop policy if exists "cuentas_select_propia" on public.cuentas;
create policy "cuentas_select_propia"
  on public.cuentas for select
  using (auth.uid() = id);

drop policy if exists "cuentas_update_propia" on public.cuentas;
create policy "cuentas_update_propia"
  on public.cuentas for update
  using (auth.uid() = id);

drop policy if exists "cuentas_insert_propia" on public.cuentas;
create policy "cuentas_insert_propia"
  on public.cuentas for insert
  with check (auth.uid() = id);


-- 2) PERFIL DE FÚTBOL ----------------------------------------------------------
-- Se renombra la tabla `perfiles` que ya existe (si existe) para no perder
-- nada de lo que ya tienes: créditos, media general, logros, etc. El `id`
-- se mantiene igual al id del usuario, así que TODAS las consultas actuales
-- que hacen `.eq("id", user.id)` siguen funcionando sin cambios.
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'perfiles')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'perfiles_futbol')
  then
    alter table public.perfiles rename to perfiles_futbol;
  end if;
end $$;

-- Si el proyecto es nuevo y no existía `perfiles`, se crea perfiles_futbol
-- desde cero con las columnas que usa el código actual.
create table if not exists public.perfiles_futbol (
  id                  uuid primary key references auth.users(id) on delete cascade,
  cuenta_id           uuid references public.cuentas(id) on delete cascade,
  es_admin            boolean not null default false,
  creditos            numeric not null default 0,
  nombre              text,
  telefono            text,
  avatar_url          text,
  nacionalidad        text,
  posicion_preferida  text,
  media_general       int default 64,
  ritmo               int default 64,
  tiro                int default 64,
  pase                int default 64,
  regate              int default 64,
  defensa             int default 64,
  fisico              int default 64,
  partidos_jugados    int default 0,
  goles_total         int default 0,
  victorias           int default 0,
  derrotas            int default 0,
  created_at          timestamptz not null default now()
);

alter table public.perfiles_futbol add column if not exists cuenta_id uuid references public.cuentas(id) on delete cascade;
update public.perfiles_futbol set cuenta_id = id where cuenta_id is null;

alter table public.perfiles_futbol enable row level security;

drop policy if exists "perfiles_futbol_select_propio" on public.perfiles_futbol;
create policy "perfiles_futbol_select_propio"
  on public.perfiles_futbol for select
  using (auth.uid() = id);

drop policy if exists "perfiles_futbol_update_propio" on public.perfiles_futbol;
create policy "perfiles_futbol_update_propio"
  on public.perfiles_futbol for update
  using (auth.uid() = id);

drop policy if exists "perfiles_futbol_insert_propio" on public.perfiles_futbol;
create policy "perfiles_futbol_insert_propio"
  on public.perfiles_futbol for insert
  with check (auth.uid() = id);

-- Los demás jugadores necesitan poder VER las cartas y estadísticas de otros
-- (listado de jugadores, tarjetas dentro de un partido, etc.), así que
-- agregamos una policy de lectura pública para usuarios autenticados.
drop policy if exists "perfiles_futbol_select_publico" on public.perfiles_futbol;
create policy "perfiles_futbol_select_publico"
  on public.perfiles_futbol for select
  using (auth.role() = 'authenticated');


-- 3) PERFIL DE PÁDEL (nuevo) ---------------------------------------------------
create table if not exists public.perfiles_padel (
  id                  uuid primary key references auth.users(id) on delete cascade,
  cuenta_id           uuid references public.cuentas(id) on delete cascade,
  nivel               text default 'Iniciación',
  posicion_preferida  text, -- 'drive' | 'reves' | 'ambos'
  partidos_jugados    int default 0,
  victorias           int default 0,
  derrotas            int default 0,
  puntos              int default 0,
  created_at          timestamptz not null default now()
);

alter table public.perfiles_padel enable row level security;

drop policy if exists "perfiles_padel_select_propio" on public.perfiles_padel;
create policy "perfiles_padel_select_propio"
  on public.perfiles_padel for select
  using (auth.uid() = id);

drop policy if exists "perfiles_padel_update_propio" on public.perfiles_padel;
create policy "perfiles_padel_update_propio"
  on public.perfiles_padel for update
  using (auth.uid() = id);

drop policy if exists "perfiles_padel_insert_propio" on public.perfiles_padel;
create policy "perfiles_padel_insert_propio"
  on public.perfiles_padel for insert
  with check (auth.uid() = id);

drop policy if exists "perfiles_padel_select_publico" on public.perfiles_padel;
create policy "perfiles_padel_select_publico"
  on public.perfiles_padel for select
  using (auth.role() = 'authenticated');


-- 4) POBLAR `cuentas` CON USUARIOS EXISTENTES ---------------------------------
insert into public.cuentas (id, correo, nombre, telefono, avatar_url)
select
  u.id,
  u.email,
  coalesce(pf.nombre, u.raw_user_meta_data->>'nombre'),
  coalesce(pf.telefono, u.raw_user_meta_data->>'telefono'),
  pf.avatar_url
from auth.users u
left join public.perfiles_futbol pf on pf.id = u.id
on conflict (id) do nothing;


-- 5) TRIGGER: crear la cuenta núcleo automáticamente al registrarse ----------
-- IMPORTANTE: si ya tenías un trigger propio que creaba una fila en
-- `perfiles` al registrarse (revisa Database > Triggers en el dashboard),
-- bórralo o ajústalo para que NO intente crear también un perfiles_futbol
-- automático: ahora ese perfil se crea a demanda desde /futbol/perfil,
-- para permitir que una cuenta nueva elija fútbol, pádel o ambos.
create or replace function public.handle_new_user_cuenta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cuentas (id, correo, nombre, telefono)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nombre',
    new.raw_user_meta_data->>'telefono'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_cuenta on auth.users;
create trigger on_auth_user_created_cuenta
  after insert on auth.users
  for each row execute procedure public.handle_new_user_cuenta();


-- ============================================================================
-- Notas / próximos pasos manuales:
--   * Revisa el Storage bucket "avatars": ahora se sube tanto a
--     `${userId}/avatar.<ext>` (foto del perfil de fútbol) como a
--     `${userId}/avatar-cuenta.<ext>` (foto de la cuenta). Confirma que las
--     policies del bucket permiten a cada usuario subir dentro de su propia
--     carpeta `${auth.uid()}/...`.
--   * Si quieres eliminar por completo la tabla vieja `perfiles`, ya no
--     existe: fue renombrada a `perfiles_futbol` (no se perdió información).
--   * Este archivo es idempotente (se puede correr más de una vez sin
--     romper nada), gracias a los `if not exists` / `on conflict`.
-- ============================================================================
