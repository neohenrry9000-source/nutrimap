-- ============================================================
-- NutriMap — Esquema Supabase (PostgreSQL 15)
-- ============================================================
-- Opciones de auth:
--  A) Supabase Auth (recomendada en producción): los usuarios viven en
--     auth.users y aquí solo guardamos un perfil por usuario.
--  B) Auth propia con password_hash (demo académica).
--
-- Este archivo implementa A) y deja columna password_hash para B) por
-- compatibilidad. Para la demo basta con Supabase Auth + JWT.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- 1. USUARIOS / PERFILES ---------------------------
create type rol_usuario as enum ('donador', 'organizacion', 'admin');

create table if not exists public.usuarios (
  id            uuid primary key default gen_random_uuid(),
  -- Si usas Supabase Auth, este id debe coincidir con auth.users.id:
  --   ALTER TABLE public.usuarios
  --   ADD CONSTRAINT usuarios_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  email         citext unique not null,
  password_hash text,                 -- solo si NO usas Supabase Auth
  rol           rol_usuario not null default 'donador',
  nombre        text,
  created_at    timestamptz not null default now()
);

-- citext requiere la extensión:
create extension if not exists "citext";

-- ---------- 2. ORGANIZACIONES --------------------------------
create type tipo_org as enum ('olla_comun', 'comedor_popular', 'otro');

create table if not exists public.organizaciones (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.usuarios(id) on delete cascade,
  nombre           text not null check (length(nombre) between 3 and 120),
  ubigeo           char(6) not null check (ubigeo ~ '^[0-9]{6}$'),
  lat              double precision,
  lng              double precision,
  nivel_necesidad  int  not null default 3 check (nivel_necesidad between 1 and 5),
  descripcion      text check (length(coalesce(descripcion,'')) <= 500),
  tipo             tipo_org not null default 'olla_comun',
  activa           boolean  not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_org_ubigeo   on public.organizaciones(ubigeo);
create index if not exists idx_org_user     on public.organizaciones(user_id);
create index if not exists idx_org_activa   on public.organizaciones(activa);

-- ---------- 3. DONACIONES ------------------------------------
create type estado_donacion as enum ('pendiente', 'completada', 'fallida');

create table if not exists public.donaciones (
  id                uuid primary key default gen_random_uuid(),
  id_donante        uuid not null references public.usuarios(id) on delete restrict,
  id_organizacion   uuid not null references public.organizaciones(id) on delete restrict,
  monto             numeric(10,2) not null check (monto > 0 and monto <= 100000),
  moneda            char(3) not null default 'PEN' check (moneda in ('PEN','USD')),
  estado            estado_donacion not null default 'pendiente',
  referencia_pago   text,             -- NUNCA guardar PAN/CVV (PCI-DSS)
  fecha             timestamptz not null default now()
);
create index if not exists idx_don_donante  on public.donaciones(id_donante);
create index if not exists idx_don_org      on public.donaciones(id_organizacion);

-- ---------- 4. MAPA DE RIESGO --------------------------------
create type nivel_riesgo_t as enum ('BAJO','MEDIO','ALTO','MUY_ALTO','SIN_DATOS');

create table if not exists public.mapa_riesgo (
  ubigeo                    char(6) primary key check (ubigeo ~ '^[0-9]{6}$'),
  departamento              text not null,
  provincia                 text,
  distrito                  text,
  total_ninos               int not null default 0,
  casos_anemia              int not null default 0,
  porcentaje_anemia         numeric(5,1),
  tiene_cobertura_comedor   boolean not null default false,
  cobertura_comedor_pct     numeric(5,1),
  nivel_riesgo              nivel_riesgo_t not null default 'SIN_DATOS',
  color_mapa                char(7) check (color_mapa ~ '^#[0-9A-Fa-f]{6}$'),
  lat                       double precision,
  lng                       double precision,
  fuente                    text not null default 'ENDES 2024 / INEI',
  periodo                   text not null default '2024',
  updated_at                timestamptz not null default now()
);
create index if not exists idx_mapa_nivel on public.mapa_riesgo(nivel_riesgo);

-- ---------- 5. AUDITORÍA -------------------------------------
create table if not exists public.auditoria_eventos (
  id         bigserial primary key,
  actor_id   uuid references public.usuarios(id) on delete set null,
  accion     text not null,
  recurso    text,
  ip         inet,
  ua         text,
  meta       jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_actor on public.auditoria_eventos(actor_id);
create index if not exists idx_audit_fecha on public.auditoria_eventos(created_at desc);

create table if not exists public.intentos_login (
  id         bigserial primary key,
  email      citext not null,
  ip         inet,
  exito      boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_intentos_email on public.intentos_login(email, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Activamos RLS en TODAS las tablas con datos del usuario.
-- Cuando no hay política que matchee, Postgres niega por defecto.
alter table public.usuarios         enable row level security;
alter table public.organizaciones   enable row level security;
alter table public.donaciones       enable row level security;
alter table public.mapa_riesgo      enable row level security;
alter table public.auditoria_eventos enable row level security;

-- Helper: ¿el usuario actual es admin?
create or replace function public.is_admin() returns boolean
language sql stable as $$
  select exists(
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- ---- mapa_riesgo: lectura pública (es data agregada y oficial) -----
drop policy if exists mapa_select on public.mapa_riesgo;
create policy mapa_select on public.mapa_riesgo
  for select using (true);
-- Solo admin puede modificar el mapa (lo carga el pipeline con la
-- service_role key, que pasa por encima de RLS).
drop policy if exists mapa_admin_all on public.mapa_riesgo;
create policy mapa_admin_all on public.mapa_riesgo
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- usuarios: cada quien lee/edita su propio perfil ---------------
drop policy if exists usuarios_self on public.usuarios;
create policy usuarios_self on public.usuarios
  for select using (id = auth.uid() or public.is_admin());
drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self on public.usuarios
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---- organizaciones: lectura pública (mapa); escritura solo dueño --
drop policy if exists org_select_public on public.organizaciones;
create policy org_select_public on public.organizaciones
  for select using (activa = true or user_id = auth.uid() or public.is_admin());

drop policy if exists org_insert_own on public.organizaciones;
create policy org_insert_own on public.organizaciones
  for insert with check (user_id = auth.uid());

drop policy if exists org_update_own on public.organizaciones;
create policy org_update_own on public.organizaciones
  for update using (user_id = auth.uid() or public.is_admin())
            with check (user_id = auth.uid() or public.is_admin());

-- ---- donaciones: donante inserta las suyas; lee donante u org ------
drop policy if exists don_insert_self on public.donaciones;
create policy don_insert_self on public.donaciones
  for insert with check (id_donante = auth.uid());

drop policy if exists don_select_involved on public.donaciones;
create policy don_select_involved on public.donaciones
  for select using (
    id_donante = auth.uid()
    or exists (
      select 1 from public.organizaciones o
      where o.id = donaciones.id_organizacion and o.user_id = auth.uid()
    )
    or public.is_admin()
  );

-- ---- auditoría: solo admin lee; cualquier autenticado inserta ------
drop policy if exists audit_admin_read on public.auditoria_eventos;
create policy audit_admin_read on public.auditoria_eventos
  for select using (public.is_admin());
drop policy if exists audit_insert_any on public.auditoria_eventos;
create policy audit_insert_any on public.auditoria_eventos
  for insert with check (auth.role() = 'authenticated' or public.is_admin());

-- ============================================================
-- TRIGGER updated_at
-- ============================================================
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_org_updated on public.organizaciones;
create trigger trg_org_updated before update on public.organizaciones
  for each row execute function public.set_updated_at();

-- ============================================================
-- CARGA DEL MAPA DESDE EL PIPELINE
-- ============================================================
-- Opción 1) desde la CLI: psql -f este-archivo.sql
-- Opción 2) carga del CSV (usa service_role para bypass RLS):
--   \copy public.mapa_riesgo(ubigeo,departamento,provincia,distrito,
--     total_ninos,casos_anemia,porcentaje_anemia,
--     tiene_cobertura_comedor,cobertura_comedor_pct,
--     nivel_riesgo,color_mapa,lat,lng)
--   from 'data_mapa_limpia.csv' csv header;
