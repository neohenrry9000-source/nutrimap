"""
Fixtures de la suite NutriMap.

Pieza central: FakeSupabase, un doble en memoria del cliente supabase-py
que implementa el subconjunto del query builder que usa el backend
(select/insert/update/delete, filtros, order/limit, embeds por FK,
constraints únicos que lanzan APIError 23505 y un storage falso).
Los tests corren SIN red y SIN tocar la base real.
"""
import copy
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import pytest
from postgrest.exceptions import APIError

# El backend debe ser importable tanto corriendo desde backend/ como
# desde la raíz del repo (CI hace `pytest backend/tests`).
BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

ORIGIN = "http://testserver"

# Config mínima ANTES de importar app/config (config lee env al importar)
os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "fake-anon")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service")
os.environ["CORS_ORIGINS"] = ORIGIN


def _ahora():
    return datetime.now(timezone.utc).isoformat()


TABLAS = [
    "usuarios", "organizaciones", "donaciones", "retiros", "metas",
    "metodos_cobro", "eventos_feed", "moderacion_eventos",
    "auditoria_eventos", "intentos_login", "mapa_riesgo", "oferta_social",
]

# Tablas con PK serial (el resto usa uuid)
SERIALES = {"eventos_feed", "moderacion_eventos", "auditoria_eventos",
            "intentos_login", "oferta_social"}

# Defaults de columnas que el backend asume que pone la BD
DEFAULTS = {
    "usuarios":       {"created_at": _ahora, "rol": lambda: "donador"},
    "organizaciones": {"activa": lambda: True, "created_at": _ahora},
    "retiros":        {"estado": lambda: "pendiente", "created_at": _ahora,
                       "fecha_solicitud": _ahora},
    "metas":          {"activa": lambda: True, "fecha_inicio": _ahora,
                       "moneda": lambda: "PEN", "created_at": _ahora},
    "metodos_cobro":  {"principal": lambda: False, "created_at": _ahora},
    "eventos_feed":   {"created_at": _ahora},
    "moderacion_eventos": {"created_at": _ahora},
    "auditoria_eventos":  {"created_at": _ahora},
    "intentos_login":     {"created_at": _ahora},
    "donaciones":     {"fecha": _ahora},
}

# FKs para resolver embeds PostgREST tipo "usuarios(nombre)"
FKS = {
    ("donaciones", "organizaciones"): ("id_organizacion", "id"),
    ("donaciones", "usuarios"):       ("id_donante", "id"),
}


def _err_23505():
    return APIError({"message": "duplicate key value violates unique constraint",
                     "code": "23505", "hint": None, "details": None})


def _err_tabla(nombre):
    return APIError({"message": f'relation "public.{nombre}" does not exist',
                     "code": "42P01", "hint": None, "details": None})


def _split_top(cols):
    """Divide 'a,b,rel(x,y)' respetando paréntesis."""
    out, depth, actual = [], 0, ""
    for ch in cols:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(actual)
            actual = ""
        else:
            actual += ch
    if actual:
        out.append(actual)
    return [t.strip() for t in out if t.strip()]


class _Query:
    def __init__(self, db, tabla):
        self.db, self.tabla = db, tabla
        self._op, self._payload = "select", None
        self._cols = "*"
        self._filtros = []
        self._orden = None
        self._limite = None

    # ---- operaciones ----
    def select(self, cols="*"):
        self._op, self._cols = "select", cols
        return self

    def insert(self, payload):
        self._op, self._payload = "insert", payload
        return self

    def update(self, payload):
        self._op, self._payload = "update", payload
        return self

    def delete(self):
        self._op = "delete"
        return self

    def upsert(self, payload, on_conflict=None):
        self._op, self._payload = "insert", payload
        return self

    # ---- filtros ----
    def eq(self, col, val):  self._filtros.append(("eq", col, val));  return self
    def gte(self, col, val): self._filtros.append(("gte", col, val)); return self
    def lte(self, col, val): self._filtros.append(("lte", col, val)); return self
    def in_(self, col, val): self._filtros.append(("in", col, list(val))); return self

    def like(self, col, patron):
        self._filtros.append(("like", col, patron))
        return self

    def order(self, col, desc=False, **kw):
        self._orden = (col, desc or kw.get("desc", False))
        return self

    def limit(self, n):
        self._limite = n
        return self

    # ---- ejecución ----
    def _match(self, row):
        for kind, col, val in self._filtros:
            v = row.get(col)
            if kind == "eq" and v != val:
                return False
            if kind == "gte" and not (v is not None and v >= val):
                return False
            if kind == "lte" and not (v is not None and v <= val):
                return False
            if kind == "in" and v not in val:
                return False
            if kind == "like":
                rx = re.escape(val).replace("\\%", ".*")
                if not re.fullmatch(rx, str(v or "")):
                    return False
        return True

    def _check_unicos(self, candidato, excluir_id=None):
        rows = [r for r in self.db.data[self.tabla] if r.get("id") != excluir_id]
        if self.tabla == "usuarios":
            if any(r.get("email") == candidato.get("email") for r in rows):
                raise _err_23505()
        if self.tabla == "organizaciones":
            if any(r.get("user_id") == candidato.get("user_id") for r in rows):
                raise _err_23505()
            nom = (candidato.get("nombre") or "").lower()
            if any((r.get("nombre") or "").lower() == nom
                   and r.get("ubigeo") == candidato.get("ubigeo") for r in rows):
                raise _err_23505()
            ruc = candidato.get("ruc")
            if ruc and any(r.get("ruc") == ruc for r in rows):
                raise _err_23505()

    def _proyectar(self, row):
        if self._cols.strip() == "*":
            return copy.deepcopy(row)
        out = {}
        for token in _split_top(self._cols):
            if token == "*":
                out.update(copy.deepcopy(row))
                continue
            m = re.fullmatch(r"(\w+)\((.*)\)", token)
            if m:
                rel, campos = m.group(1), [c.strip() for c in m.group(2).split(",")]
                fk = FKS.get((self.tabla, rel))
                emb = None
                if fk:
                    local, remoto = fk
                    for r2 in self.db.data.get(rel, []):
                        if r2.get(remoto) == row.get(local):
                            emb = {c: copy.deepcopy(r2.get(c)) for c in campos}
                            break
                out[rel] = emb
            else:
                out[token] = copy.deepcopy(row.get(token))
        return out

    def execute(self):
        if self.tabla in self.db.faltantes:
            raise _err_tabla(self.tabla)
        rows = self.db.data[self.tabla]

        if self._op == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            insertados = []
            for p in payloads:
                fila = copy.deepcopy(p)
                for col, gen in DEFAULTS.get(self.tabla, {}).items():
                    fila.setdefault(col, gen())
                if "id" not in fila:
                    if self.tabla in SERIALES:
                        fila["id"] = self.db.serial(self.tabla)
                    else:
                        fila["id"] = str(uuid.uuid4())
                self._check_unicos(fila)
                rows.append(fila)
                insertados.append(copy.deepcopy(fila))
            return SimpleNamespace(data=insertados)

        seleccion = [r for r in rows if self._match(r)]

        if self._op == "update":
            for r in seleccion:
                candidato = {**r, **self._payload}
                self._check_unicos(candidato, excluir_id=r.get("id"))
            for r in seleccion:
                r.update(copy.deepcopy(self._payload))
            return SimpleNamespace(data=[copy.deepcopy(r) for r in seleccion])

        if self._op == "delete":
            for r in seleccion:
                rows.remove(r)
            return SimpleNamespace(data=[copy.deepcopy(r) for r in seleccion])

        # select
        if self._orden:
            col, desc = self._orden
            seleccion = sorted(seleccion,
                               key=lambda r: (r.get(col) is None, r.get(col)),
                               reverse=desc)
        if self._limite is not None:
            seleccion = seleccion[: self._limite]
        return SimpleNamespace(data=[self._proyectar(r) for r in seleccion])


class _Bucket:
    def __init__(self, storage, nombre):
        self.storage, self.nombre = storage, nombre

    def upload(self, ruta, data, opciones=None):
        self.storage.objetos[f"{self.nombre}/{ruta}"] = data

    def get_public_url(self, ruta):
        return f"https://storage.fake/{self.nombre}/{ruta}"

    def remove(self, rutas):
        for r in rutas:
            self.storage.objetos.pop(f"{self.nombre}/{r}", None)


class _Storage:
    def __init__(self):
        self.objetos = {}

    def from_(self, nombre):
        return _Bucket(self, nombre)


class FakeSupabase:
    def __init__(self):
        self.data = {t: [] for t in TABLAS}
        self.faltantes = set()   # simula tablas sin migrar (APIError)
        self.storage = _Storage()
        self._seriales = {}

    def table(self, nombre):
        return _Query(self, nombre)

    def serial(self, tabla):
        self._seriales[tabla] = self._seriales.get(tabla, 0) + 1
        return self._seriales[tabla]


# --------------------------- fixtures Flask ---------------------------

@pytest.fixture(scope="session")
def app():
    from app import create_app
    application = create_app()
    application.config["TESTING"] = True
    application.extensions["limiter"].enabled = False
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def db(monkeypatch):
    """FakeSupabase fresco, parcheado en todos los puntos de acceso."""
    fake = FakeSupabase()
    objetivo = lambda: fake  # noqa: E731
    for mod in ("routes.auth", "routes.organizaciones",
                "routes.donaciones", "routes.admin"):
        monkeypatch.setattr(f"{mod}.client_service", objetivo)
    monkeypatch.setattr("routes.donaciones.client_anon", objetivo)
    monkeypatch.setattr("routes.mapa.client_anon", objetivo)
    monkeypatch.setattr("services.supabase_client.client_service", objetivo, raising=False)
    monkeypatch.setattr("services.supabase_client.client_anon", objetivo, raising=False)
    return fake


# --------------------------- helpers de auth ---------------------------

def headers(app, usuario=None):
    """Headers con Origin permitido y, si se pasa usuario, Bearer JWT."""
    h = {"Origin": ORIGIN}
    if usuario is not None:
        from services.security import issue_jwt
        with app.app_context():
            h["Authorization"] = f"Bearer {issue_jwt(usuario['id'], usuario['rol'])}"
    return h


@pytest.fixture
def auth(app):
    return lambda usuario=None: headers(app, usuario)
