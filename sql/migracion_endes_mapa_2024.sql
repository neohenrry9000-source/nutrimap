-- ============================================================
-- NutriMap — Migración: endes_mapa_2024 -> mapa_riesgo
-- Ejecutar en Supabase SQL Editor (rol postgres, salta RLS).
-- Fecha: 2026-07-04
-- ============================================================
-- Contexto:
--   * endes_mapa_2024 fue creada importando endes_mapa_final.csv y
--     Supabase infirió `ubigeo` como número => los códigos con cero a
--     la izquierda (01xxxx..09xxxx) perdieron el padding.
--   * El backend (routes/mapa.py) lee la tabla canónica `mapa_riesgo`.
--   * Estrategia: NO recrear endes_mapa_2024; se corrige el tipo
--     in-place con ALTER ... USING lpad(...) (recupera los ceros de
--     forma determinística porque todo ubigeo peruano tiene 6 dígitos)
--     y luego se vuelca a mapa_riesgo, que queda como fuente única.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0. Prerrequisitos (idempotentes; existen si ya corriste schema.sql)
-- ------------------------------------------------------------
create extension if not exists "pgcrypto";
create extension if not exists "citext";

do $$ begin
  create type nivel_riesgo_t as enum ('BAJO','MEDIO','ALTO','MUY_ALTO','SIN_DATOS');
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 1. CORREGIR endes_mapa_2024.ubigeo (número -> text de 6 dígitos)
--    lpad restaura los ceros perdidos: 10101 -> '010101'
-- ------------------------------------------------------------
alter table public.endes_mapa_2024
  alter column ubigeo type text
  using lpad(trim(ubigeo::text), 6, '0');

-- Garantía de formato hacia adelante
alter table public.endes_mapa_2024
  drop constraint if exists endes_mapa_2024_ubigeo_chk;
alter table public.endes_mapa_2024
  add constraint endes_mapa_2024_ubigeo_chk check (ubigeo ~ '^[0-9]{6}$');

create unique index if not exists idx_endes_mapa_2024_ubigeo
  on public.endes_mapa_2024(ubigeo);

-- ------------------------------------------------------------
-- 2. TABLA CANÓNICA mapa_riesgo (la que consume el backend)
--    Igual a sql/schema.sql + columna observacion_calidad_dato que
--    faltaba en el esquema original.
-- ------------------------------------------------------------
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

alter table public.mapa_riesgo
  add column if not exists observacion_calidad_dato text;

create index if not exists idx_mapa_nivel on public.mapa_riesgo(nivel_riesgo);

-- ------------------------------------------------------------
-- 3. VOLCAR endes_mapa_2024 -> mapa_riesgo (upsert por ubigeo)
--    AJUSTAR aquí si alguna columna de tu CSV tiene otro nombre.
--    El nivel_riesgo textual se normaliza a mayúsculas con "_".
-- ------------------------------------------------------------
insert into public.mapa_riesgo (
  ubigeo, departamento, provincia, distrito,
  total_ninos, casos_anemia, porcentaje_anemia,
  tiene_cobertura_comedor, cobertura_comedor_pct,
  nivel_riesgo, color_mapa, lat, lng,
  fuente, periodo, observacion_calidad_dato
)
select
  e.ubigeo,
  coalesce(e.departamento, 'Desconocido'),
  e.provincia,
  e.distrito,
  coalesce(e.total_ninos, 0),
  coalesce(e.casos_anemia, 0),
  e.porcentaje_anemia,
  coalesce(e.tiene_cobertura_comedor, false),
  e.cobertura_comedor_pct,
  case upper(replace(trim(coalesce(e.nivel_riesgo::text, 'SIN_DATOS')), ' ', '_'))
    when 'BAJO'     then 'BAJO'::nivel_riesgo_t
    when 'MEDIO'    then 'MEDIO'::nivel_riesgo_t
    when 'ALTO'     then 'ALTO'::nivel_riesgo_t
    when 'MUY_ALTO' then 'MUY_ALTO'::nivel_riesgo_t
    else 'SIN_DATOS'::nivel_riesgo_t
  end,
  nullif(trim(e.color_mapa::text), ''),
  e.lat,
  e.lng,
  coalesce(e.fuente,  'ENDES 2024 / INEI'),
  coalesce(e.periodo::text, '2024'),
  e.observacion_calidad_dato
from public.endes_mapa_2024 e
on conflict (ubigeo) do update set
  departamento             = excluded.departamento,
  provincia                = excluded.provincia,
  distrito                 = excluded.distrito,
  total_ninos              = excluded.total_ninos,
  casos_anemia             = excluded.casos_anemia,
  porcentaje_anemia        = excluded.porcentaje_anemia,
  tiene_cobertura_comedor  = excluded.tiene_cobertura_comedor,
  cobertura_comedor_pct    = excluded.cobertura_comedor_pct,
  nivel_riesgo             = excluded.nivel_riesgo,
  color_mapa               = excluded.color_mapa,
  lat                      = excluded.lat,
  lng                      = excluded.lng,
  fuente                   = excluded.fuente,
  periodo                  = excluded.periodo,
  observacion_calidad_dato = excluded.observacion_calidad_dato,
  updated_at               = now();

-- ------------------------------------------------------------
-- 4. SEGURIDAD / RLS
-- ------------------------------------------------------------

-- 4.1 is_admin(): SECURITY DEFINER evita la recursión infinita
--     (la política de usuarios llama a is_admin, que lee usuarios,
--     que vuelve a evaluar la política...).
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.usuarios
    where id = auth.uid() and rol = 'admin'
  );
$$;

-- 4.2 intentos_login: schema.sql NO le activó RLS => con la anon key
--     era legible/escribible vía PostgREST. Se activa RLS sin
--     políticas: solo el backend (service key) puede tocarla.
alter table public.intentos_login enable row level security;

-- 4.3 endes_mapa_2024 queda como staging: RLS activo, solo lectura
--     admin (el público consume mapa_riesgo / la vista).
alter table public.endes_mapa_2024 enable row level security;
drop policy if exists endes_admin_read on public.endes_mapa_2024;
create policy endes_admin_read on public.endes_mapa_2024
  for select using (public.is_admin());

-- 4.4 mapa_riesgo: lectura pública, escritura solo admin/service key
--     (idempotente; ya estaba en schema.sql)
alter table public.mapa_riesgo enable row level security;
drop policy if exists mapa_select on public.mapa_riesgo;
create policy mapa_select on public.mapa_riesgo
  for select using (true);
drop policy if exists mapa_admin_all on public.mapa_riesgo;
create policy mapa_admin_all on public.mapa_riesgo
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------
-- 5. VISTA PÚBLICA (opcional pero recomendada): expone solo columnas
--    de presentación. security_invoker => respeta el RLS de la tabla.
-- ------------------------------------------------------------
create or replace view public.vista_mapa_publico
  with (security_invoker = on) as
select
  ubigeo, departamento, provincia, distrito,
  total_ninos, casos_anemia, porcentaje_anemia,
  tiene_cobertura_comedor, cobertura_comedor_pct,
  nivel_riesgo, color_mapa, lat, lng,
  fuente, periodo, observacion_calidad_dato
from public.mapa_riesgo;

grant select on public.vista_mapa_publico to anon, authenticated;

-- ------------------------------------------------------------
-- 6. Trigger updated_at para mapa_riesgo
-- ------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;

drop trigger if exists trg_mapa_updated on public.mapa_riesgo;
create trigger trg_mapa_updated before update on public.mapa_riesgo
  for each row execute function public.set_updated_at();

commit;

-- ------------------------------------------------------------
-- VERIFICACIÓN (ejecutar después del commit):
-- ------------------------------------------------------------
-- select count(*) total, count(*) filter (where ubigeo !~ '^[0-9]{6}$') mal_formados
--   from public.mapa_riesgo;
-- select ubigeo, departamento, nivel_riesgo from public.mapa_riesgo
--   where ubigeo like '0%' limit 10;   -- deben aparecer 01xxxx..09xxxx
