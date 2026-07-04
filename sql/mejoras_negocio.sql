-- ============================================================
-- NutriMap — Mejoras de negocio: unicidad de organizaciones
-- Ejecutar en Supabase SQL Editor (rol postgres).
-- Fecha: 2026-07-04
-- ============================================================
-- Qué hace:
--   1) Una organización por usuario (registro único). El backend ya
--      responde 409, pero el índice único cierra la condición de
--      carrera (dos requests simultáneos).
--   2) Evita duplicados: mismo nombre (sin distinguir mayúsculas) en
--      el mismo distrito.
--   3) Índice para el historial de donaciones ordenado por fecha.
--
-- Si el paso 0 devuelve filas, hay duplicados preexistentes que debes
-- resolver a mano ANTES: la creación del índice único fallaría y la
-- transacción se revierte completa (no deja nada a medias).
-- ============================================================

-- ---------- 0. DIAGNÓSTICO (solo lectura, correr primero) ----------
select user_id, count(*) as organizaciones
from public.organizaciones
group by user_id having count(*) > 1;

select lower(nombre) as nombre, ubigeo, count(*) as repetidas
from public.organizaciones
group by lower(nombre), ubigeo having count(*) > 1;

-- ---------- 1. CONSTRAINTS ----------
begin;

-- Registro único: una organización por usuario
create unique index if not exists uq_org_user
  on public.organizaciones(user_id);

-- Anti-duplicados: mismo nombre en el mismo distrito
create unique index if not exists uq_org_nombre_ubigeo
  on public.organizaciones (lower(nombre), ubigeo);

-- Historial: las consultas ordenan por fecha descendente
create index if not exists idx_don_fecha
  on public.donaciones (fecha desc);

commit;

-- ---------- RLS ----------
-- No se necesitan cambios: los endpoints nuevos (/me, /mi-perfil,
-- /mis-donaciones, /mi-organizacion/donaciones, /logout) corren en el
-- backend con service key y la autorización la aplica Flask
-- (require_auth / require_role). Las políticas existentes siguen
-- protegiendo el acceso directo con la anon key.

-- ---------- VERIFICACIÓN ----------
-- select indexname from pg_indexes
--   where tablename in ('organizaciones','donaciones')
--   order by indexname;
