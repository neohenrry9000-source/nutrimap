-- ============================================================
-- NutriMap — Fase Admin: aprobación de retiros, métodos de
-- cobro, avatares y panel de administración.
-- Ejecutar COMPLETO en Supabase SQL Editor (rol postgres).
-- Requiere haber corrido antes sql/evolucion_producto.sql.
-- Fecha: 2026-07-04
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. RETIROS: trazabilidad de la aprobación
-- ------------------------------------------------------------
alter table public.retiros
  add column if not exists nota_admin    text,
  add column if not exists procesado_por uuid references public.usuarios(id) on delete set null;

alter table public.retiros drop constraint if exists retiros_nota_admin_chk;
alter table public.retiros
  add constraint retiros_nota_admin_chk
  check (nota_admin is null or length(nota_admin) <= 500);

-- ------------------------------------------------------------
-- 2. MÉTODOS DE COBRO de la organización (tabla aparte:
--    data sensible, múltiples métodos, un principal por org)
-- ------------------------------------------------------------
create table if not exists public.metodos_cobro (
  id              uuid primary key default gen_random_uuid(),
  id_organizacion uuid not null references public.organizaciones(id) on delete cascade,
  tipo            text not null check (tipo in ('banco', 'yape')),
  titular         text not null check (length(titular) between 3 and 120),
  -- tipo banco
  banco           text check (banco is null or length(banco) <= 60),
  tipo_cuenta     text check (tipo_cuenta in ('ahorros', 'corriente')),
  numero_cuenta   text check (numero_cuenta is null or numero_cuenta ~ '^[0-9-]{8,20}$'),
  cci             text check (cci is null or cci ~ '^[0-9]{20}$'),
  -- tipo yape
  yape_numero     text check (yape_numero is null or yape_numero ~ '^9[0-9]{8}$'),
  observaciones   text check (observaciones is null or length(observaciones) <= 300),
  principal       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- coherencia por tipo
  check (tipo <> 'banco' or (banco is not null and numero_cuenta is not null)),
  check (tipo <> 'yape'  or yape_numero is not null)
);
create index if not exists idx_mcobro_org on public.metodos_cobro(id_organizacion);
-- Un solo método principal por organización
create unique index if not exists uq_mcobro_principal
  on public.metodos_cobro(id_organizacion) where principal;

drop trigger if exists trg_mcobro_updated on public.metodos_cobro;
create trigger trg_mcobro_updated before update on public.metodos_cobro
  for each row execute function public.set_updated_at();

-- RLS SIN políticas: los datos bancarios/Yape de una organización
-- jamás son accesibles con la anon key; solo el backend (service key)
-- los lee, y Flask restringe a la org dueña o al admin.
alter table public.metodos_cobro enable row level security;

-- ------------------------------------------------------------
-- 3. AVATARES: columna en usuarios y organizaciones
-- ------------------------------------------------------------
alter table public.usuarios
  add column if not exists avatar_url text;
alter table public.organizaciones
  add column if not exists avatar_url text;

-- ------------------------------------------------------------
-- 4. STORAGE: bucket público de avatares
--    Escrituras: SOLO el backend (service key salta las políticas
--    de storage). Lecturas: públicas (son fotos de perfil).
--    No se crea ninguna política de escritura para anon/authenticated.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatares', 'avatares', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. PROMOVER UN ADMIN (edita el email y descomenta):
-- ------------------------------------------------------------
-- update public.usuarios set rol = 'admin' where email = 'tu-admin@dominio.com';

commit;

-- ------------------------------------------------------------
-- VERIFICACIÓN:
-- select column_name from information_schema.columns
--   where table_name = 'retiros' and column_name in ('nota_admin','procesado_por');
-- select * from storage.buckets where id = 'avatares';
-- select rol, count(*) from public.usuarios group by rol;
-- ------------------------------------------------------------
