-- ============================================================
-- NutriMap — Fase Moderación: suspensión/baneo de usuarios y
-- organizaciones con trazabilidad completa.
-- Ejecutar COMPLETO en Supabase SQL Editor (rol postgres).
-- Fecha: 2026-07-04
-- ============================================================
-- Modelo:
--   * estado en la entidad ('activo' | 'suspendido' | 'baneado')
--   * historial inmutable en moderacion_eventos (quién, qué, motivo)
--   * NADA se borra: donaciones, retiros y auditoría quedan intactos.
-- Reglas aplicadas por el backend:
--   * usuario baneado    -> no puede iniciar sesión
--   * usuario suspendido -> entra y VE su historial; escrituras 403
--   * org suspendida/baneada -> sale del mapa público, no recibe
--     donaciones y su dueño no puede editarla ni retirar fondos
-- ============================================================

do $$ begin
  create type estado_moderacion as enum ('activo', 'suspendido', 'baneado');
exception when duplicate_object then null;
end $$;

begin;

alter table public.usuarios
  add column if not exists estado estado_moderacion not null default 'activo';
alter table public.organizaciones
  add column if not exists estado estado_moderacion not null default 'activo';

create index if not exists idx_usuarios_estado on public.usuarios(estado);
create index if not exists idx_org_estado      on public.organizaciones(estado);

-- Historial de moderación: evidencia inmutable (solo INSERT desde el
-- backend; jamás se actualiza ni borra).
create table if not exists public.moderacion_eventos (
  id            bigserial primary key,
  tipo_entidad  text not null check (tipo_entidad in ('usuario', 'organizacion')),
  entidad_id    uuid not null,
  accion        text not null check (accion in ('suspender', 'banear', 'reactivar')),
  estado_previo estado_moderacion,
  motivo        text not null check (length(motivo) between 5 and 500),
  realizado_por uuid references public.usuarios(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists idx_moderacion_entidad
  on public.moderacion_eventos(tipo_entidad, entidad_id, created_at desc);

-- RLS SIN políticas: el historial de moderación solo lo lee/escribe el
-- backend (service key); nunca es visible con la anon key.
alter table public.moderacion_eventos enable row level security;

commit;

-- ------------------------------------------------------------
-- VERIFICACIÓN:
-- select estado, count(*) from public.usuarios group by estado;
-- select estado, count(*) from public.organizaciones group by estado;
-- select count(*) from public.moderacion_eventos;
-- ------------------------------------------------------------
