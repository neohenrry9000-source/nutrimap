"""
Wrapper sobre supabase-py.
  * `client_anon()`  -> usa la anon key + JWT del usuario; RLS aplica.
  * `client_service()` -> service_role key; SALTA RLS. Solo usar en
    procesos internos (ej. cargar mapa_riesgo desde el pipeline).

Nunca exponer la service_role key al frontend.
"""
from functools import lru_cache
from flask import current_app
from supabase import create_client, Client


@lru_cache(maxsize=1)
def _service() -> Client:
    cfg = current_app.config
    if not cfg.get("SUPABASE_SERVICE_KEY"):
        raise RuntimeError("SUPABASE_SERVICE_KEY no configurado")
    return create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_SERVICE_KEY"])


def client_anon(user_jwt: str | None = None) -> Client:
    """Devuelve cliente con la anon key; opcionalmente añade JWT del user."""
    cfg = current_app.config
    c = create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_ANON_KEY"])
    if user_jwt:
        c.postgrest.auth(user_jwt)
    return c


def client_service() -> Client:
    return _service()
