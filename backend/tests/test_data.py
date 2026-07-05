"""
Datos de muestra reutilizables por toda la suite (factories simples).

Cada factory devuelve un dict listo para insertar en FakeSupabase y lo
inserta si se le pasa el fake db. Los ids son uuid válidos porque los
endpoints los validan por regex.
"""
import uuid


def _uid():
    return str(uuid.uuid4())


def usuario(db=None, **kw):
    fila = {
        "id": _uid(),
        "email": f"user-{_uid()[:8]}@test.pe",
        "password_hash": "$argon2id$fake",
        "rol": "donador",
        "nombre": "Usuario Test",
        "estado": "activo",
        "created_at": "2026-01-01T00:00:00+00:00",
        **kw,
    }
    if db is not None:
        db.data["usuarios"].append(fila)
    return fila


def organizacion(db=None, user_id=None, **kw):
    fila = {
        "id": _uid(),
        "user_id": user_id or _uid(),
        "nombre": f"Comedor {_uid()[:6]}",
        "ubigeo": "150101",
        "nivel_necesidad": 3,
        "descripcion": "Comedor de prueba",
        "tipo": "comedor_popular",
        "activa": True,
        "estado": "activo",
        "created_at": "2026-01-02T00:00:00+00:00",
        **kw,
    }
    if db is not None:
        db.data["organizaciones"].append(fila)
    return fila


def donacion(db=None, id_donante=None, id_organizacion=None, **kw):
    fila = {
        "id": _uid(),
        "id_donante": id_donante or _uid(),
        "id_organizacion": id_organizacion or _uid(),
        "monto": 50.0,
        "moneda": "PEN",
        "estado": "completada",
        "metodo_pago": "tarjeta",
        "es_anonima": False,
        "referencia_pago": "ref-test",
        "fecha": "2026-06-01T10:00:00+00:00",
        **kw,
    }
    if db is not None:
        db.data["donaciones"].append(fila)
    return fila


def retiro(db=None, id_organizacion=None, **kw):
    fila = {
        "id": _uid(),
        "id_organizacion": id_organizacion or _uid(),
        "monto": 20.0,
        "moneda": "PEN",
        "estado": "pendiente",
        "nota": None,
        "fecha_solicitud": "2026-06-02T10:00:00+00:00",
        "fecha_procesamiento": None,
        **kw,
    }
    if db is not None:
        db.data["retiros"].append(fila)
    return fila


def distrito_mapa(db=None, **kw):
    fila = {
        "ubigeo": "150101",
        "departamento": "Lima",
        "provincia": "1501",
        "distrito": "150101",
        "total_ninos": 40,
        "casos_anemia": 12,
        "porcentaje_anemia": 30.0,
        "tiene_cobertura_comedor": True,
        "cobertura_comedor_pct": 50.0,
        "nivel_riesgo": "MEDIO",
        "color_mapa": "#f1c40f",
        "lat": -12.05,
        "lng": -77.03,
        "fuente": "ENDES 2024 / INEI",
        "periodo": "2024",
        **kw,
    }
    if db is not None:
        db.data["mapa_riesgo"].append(fila)
    return fila


def test_factories_generan_ids_validos():
    import re
    rx = re.compile(r"^[0-9a-f-]{36}$")
    assert rx.fullmatch(usuario()["id"])
    assert rx.fullmatch(organizacion()["id"])
    assert rx.fullmatch(donacion()["id"])
