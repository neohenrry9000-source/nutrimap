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
    cfg = current_app.config
    c = create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_ANON_KEY"])
    if user_jwt:
        c.postgrest.auth(user_jwt)
    return c

def client_service() -> Client:
    return _service()