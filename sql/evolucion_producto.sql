-- ============================================================
-- NutriMap — Evolución de producto
-- Ejecutar COMPLETO en Supabase SQL Editor (rol postgres).
-- Fecha: 2026-07-04
-- ============================================================
-- Contiene:
--   1) Yape + donación anónima (columnas y estados en donaciones)
--   2) Organizaciones: datos completos (dirección, contacto, RUC...)
--   3) Retiros de fondos con trigger anti-sobregiro
--   4) Metas de recaudación (organización / departamento / global)
--   5) Feed de eventos en tiempo real (Supabase Realtime)
--   6) Base masiva de oferta social ENDES (comedores/ollas por distrito)
--   7) RLS de todo lo nuevo
-- ============================================================

-- ------------------------------------------------------------
-- 0. Nuevos estados de donación (ALTER TYPE no puede ir dentro
--    de la transacción; correr estas 3 líneas primero tal cual)
-- ------------------------------------------------------------
alter type estado_donacion add value if not exists 'confirmada';
alter type estado_donacion add value if not exists 'observada';
alter type estado_donacion add value if not exists 'rechazada';

begin;

-- ------------------------------------------------------------
-- 1. DONACIONES: método de pago + anonimato
-- ------------------------------------------------------------
alter table public.donaciones
  add column if not exists metodo_pago text not null default 'tarjeta';
alter table public.donaciones drop constraint if exists don_metodo_chk;
alter table public.donaciones
  add constraint don_metodo_chk check (metodo_pago in ('tarjeta', 'yape'));

-- Anónima = anónima para el público y para la organización.
-- id_donante SIEMPRE se conserva (trazabilidad/auditoría interna).
alter table public.donaciones
  add column if not exists es_anonima boolean not null default false;

-- ------------------------------------------------------------
-- 2. ORGANIZACIONES: registro completo
-- ------------------------------------------------------------
alter table public.organizaciones
  add column if not exists direccion      text,
  add column if not exists telefono       text,
  add column if not exists email_contacto citext,
  add column if not exists ruc            text,
  add column if not exists cobertura      text;

alter table public.organizaciones drop constraint if exists org_telefono_chk;
alter table public.organizaciones
  add constraint org_telefono_chk
  check (telefono is null or telefono ~ '^[0-9+() -]{6,15}$');

alter table public.organizaciones drop constraint if exists org_ruc_chk;
alter table public.organizaciones
  add constraint org_ruc_chk check (ruc is null or ruc ~ '^[0-9]{11}$');

alter table public.organizaciones drop constraint if exists org_direccion_chk;
alter table public.organizaciones
  add constraint org_direccion_chk
  check (direccion is null or length(direccion) <= 200);

alter table public.organizaciones drop constraint if exists org_cobertura_chk;
alter table public.organizaciones
  add constraint org_cobertura_chk
  check (cobertura is null or length(cobertura) <= 300);

-- RUC único cuando existe (dos orgs no pueden compartir RUC)
create unique index if not exists uq_org_ruc
  on public.organizaciones(ruc) where ruc is not null;

-- ------------------------------------------------------------
-- 3. RETIROS de fondos
-- ------------------------------------------------------------
do $$ begin
  create type estado_retiro as enum
    ('pendiente', 'aprobado', 'observado', 'completado', 'rechazado');
exception when duplicate_object then null;
end $$;

create table if not exists public.retiros (
  id                  uuid primary key default gen_random_uuid(),
  id_organizacion     uuid not null references public.organizaciones(id) on delete restrict,
  monto               numeric(12,2) not null check (monto > 0),
  moneda              char(3) not null default 'PEN' check (moneda in ('PEN','USD')),
  estado              estado_retiro not null default 'pendiente',
  nota                text check (length(coalesce(nota,'')) <= 300),
  fecha_solicitud     timestamptz not null default now(),
  fecha_procesamiento timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists idx_retiros_org   on public.retiros(id_organizacion);
create index if not exists idx_retiros_fecha on public.retiros(fecha_solicitud desc);

-- Anti-sobregiro a nivel de BD: nadie (ni un bug del backend) puede
-- solicitar más de: recaudado - (retiros no rechazados).
create or replace function public.check_retiro_disponible() returns trigger
language plpgsql as $$
declare
  v_recaudado  numeric;
  v_bloqueado  numeric;
begin
  select coalesce(sum(monto), 0) into v_recaudado
    from public.donaciones
   where id_organizacion = new.id_organizacion
     and moneda = new.moneda
     and estado in ('completada', 'confirmada');

  select coalesce(sum(monto), 0) into v_bloqueado
    from public.retiros
   where id_organizacion = new.id_organizacion
     and moneda = new.moneda
     and estado in ('pendiente', 'aprobado', 'observado', 'completado')
     and id <> new.id;

  if new.monto > v_recaudado - v_bloqueado then
    raise exception 'monto_excede_disponible';
  end if;
  return new;
end; $$;

drop trigger if exists trg_retiro_disponible on public.retiros;
create trigger trg_retiro_disponible
  before insert on public.retiros
  for each row execute function public.check_retiro_disponible();

-- ------------------------------------------------------------
-- 4. METAS de recaudación
-- ------------------------------------------------------------
create table if not exists public.metas (
  id              uuid primary key default gen_random_uuid(),
  tipo            text not null check (tipo in ('organizacion','departamento','global')),
  id_organizacion uuid references public.organizaciones(id) on delete cascade,
  departamento    char(2) check (departamento ~ '^[0-9]{2}$'),
  titulo          text not null check (length(titulo) between 3 and 120),
  descripcion     text check (length(coalesce(descripcion,'')) <= 300),
  objetivo_monto  numeric(12,2) not null check (objetivo_monto > 0),
  moneda          char(3) not null default 'PEN' check (moneda in ('PEN','USD')),
  fecha_inicio    timestamptz not null default now(),
  fecha_fin       timestamptz,
  activa          boolean not null default true,
  created_at      timestamptz not null default now(),
  check ((tipo = 'organizacion') = (id_organizacion is not null)),
  check ((tipo = 'departamento') = (departamento is not null))
);
-- Una sola meta activa por organización, y una global activa.
create unique index if not exists uq_meta_org_activa
  on public.metas(id_organizacion) where activa and tipo = 'organizacion';
create unique index if not exists uq_meta_global_activa
  on public.metas(tipo) where activa and tipo = 'global';
create index if not exists idx_metas_activa on public.metas(activa, tipo);

-- Meta global de arranque (edítala o desactívala cuando quieras).
insert into public.metas (id, tipo, titulo, descripcion, objetivo_monto, moneda)
values ('00000000-0000-0000-0000-00000000feed', 'global',
        'Meta solidaria NutriMap 2026',
        'Recaudación conjunta para organizaciones de apoyo alimentario en zonas priorizadas.',
        10000, 'PEN')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. FEED de eventos (tiempo real)
--    El backend escribe eventos YA anonimizados: aquí nunca entra
--    id de donante ni email. Por eso su lectura puede ser pública.
-- ------------------------------------------------------------
create table if not exists public.eventos_feed (
  id           bigserial primary key,
  tipo         text not null check (tipo in ('donacion','organizacion','retiro','meta')),
  titulo       text not null,
  mensaje      text,
  departamento text,
  monto        numeric(10,2),
  moneda       char(3),
  created_at   timestamptz not null default now()
);
create index if not exists idx_feed_fecha on public.eventos_feed(created_at desc);

-- Realtime: publicar INSERTs de eventos_feed
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'eventos_feed'
  ) then
    alter publication supabase_realtime add table public.eventos_feed;
  end if;
end $$;

-- ------------------------------------------------------------
-- 6. OFERTA SOCIAL masiva (ENDES: hogares que usan comedor)
--    Registros institucionales agregados por distrito; conviven con
--    las organizaciones de usuarios pero en tabla separada.
-- ------------------------------------------------------------
create table if not exists public.oferta_social (
  id                   bigserial primary key,
  ubigeo               char(6) not null check (ubigeo ~ '^[0-9]{6}$'),
  departamento         text not null,
  provincia_code       char(4),
  localidad            text,
  tipo                 text not null default 'comedor_popular',
  hogares_encuestados  int not null default 0,
  hogares_usan_comedor int not null default 0,
  uso_comedor_pct      numeric(5,1),
  lat                  double precision,
  lng                  double precision,
  fuente               text not null default 'ENDES 2024 / INEI (PS_COMEDOR)',
  periodo              text not null default '2024',
  created_at           timestamptz not null default now(),
  unique (ubigeo, tipo)
);
create index if not exists idx_oferta_ubigeo on public.oferta_social(ubigeo);

-- ------------------------------------------------------------
-- 7. RLS de las tablas nuevas
-- ------------------------------------------------------------
-- retiros: SIN políticas => solo backend (service key). El historial
-- financiero jamás es visible con la anon key.
alter table public.retiros enable row level security;

-- metas: el público puede ver metas activas (alimentan las barras).
alter table public.metas enable row level security;
drop policy if exists metas_select_activas on public.metas;
create policy metas_select_activas on public.metas
  for select using (activa = true);

-- eventos_feed: lectura pública (data ya anonimizada), escritura solo backend.
alter table public.eventos_feed enable row level security;
drop policy if exists feed_select_public on public.eventos_feed;
create policy feed_select_public on public.eventos_feed
  for select using (true);

-- oferta_social: lectura pública (estadística oficial agregada).
alter table public.oferta_social enable row level security;
drop policy if exists oferta_select_public on public.oferta_social;
create policy oferta_select_public on public.oferta_social
  for select using (true);

commit;

-- ------------------------------------------------------------
-- CARGA DE OFERTA SOCIAL:
--   python pipeline/build_oferta_social.py          -> genera data/out/oferta_social.csv
--   python pipeline/build_oferta_social.py --load   -> además la sube a Supabase
--     (usa SUPABASE_URL y SUPABASE_SERVICE_KEY del entorno / backend/.env)
--
-- VERIFICACIÓN (después del commit):
-- select count(*) from public.oferta_social;
-- select tipo, count(*) from public.eventos_feed group by tipo;
-- select * from public.metas where activa;
-- ------------------------------------------------------------
