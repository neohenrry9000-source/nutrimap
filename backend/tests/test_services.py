"""Servicios puros: seguridad, niveles, finanzas, geo, storage, feed."""
import base64

import pytest

from services.donaciones import resumen_donaciones
from services.finanzas import calcular_finanzas
from services.geo import departamento_de, DEPARTAMENTOS
from services.niveles import calcular_nivel, NIVELES
from services.security import hash_password, verify_password, issue_jwt, decode_jwt
from services.storage import subir_avatar, AvatarInvalido
from tests import test_data as datos


class TestPasswords:
    def test_hash_y_verify(self):
        h = hash_password("ClaveSegura123")
        assert h != "ClaveSegura123"
        assert verify_password("ClaveSegura123", h)
        assert not verify_password("otra", h)

    def test_verify_con_hash_corrupto_no_explota(self):
        assert verify_password("x", "no-es-un-hash") is False


class TestJWT:
    def test_roundtrip(self, app):
        with app.app_context():
            tok = issue_jwt("user-1", "donador")
            payload = decode_jwt(tok)
        assert payload["sub"] == "user-1" and payload["rol"] == "donador"

    def test_token_invalido(self, app):
        with app.app_context():
            assert decode_jwt("basura.token.roto") is None


class TestNiveles:
    def test_sin_donaciones_semilla(self):
        n = calcular_nivel([])
        assert n["clave"] == "semilla"
        assert n["siguiente"]["nombre"] == "Bronce"
        assert n["siguiente"]["falta_pen"] == 100

    def test_umbral_exacto_sube(self):
        rows = [{"monto": 100, "moneda": "PEN", "estado": "completada"}]
        assert calcular_nivel(rows)["clave"] == "bronce"

    def test_pendientes_no_suman(self):
        rows = [{"monto": 500, "moneda": "PEN", "estado": "pendiente"}]
        n = calcular_nivel(rows)
        assert n["clave"] == "semilla" and n["donaciones_ingresadas"] == 0

    def test_usd_convierte(self):
        rows = [{"monto": 100, "moneda": "USD", "estado": "confirmada"}]
        assert calcular_nivel(rows)["total_pen"] == 380.0

    def test_nivel_maximo_sin_siguiente(self):
        rows = [{"monto": 6000, "moneda": "PEN", "estado": "completada"}]
        n = calcular_nivel(rows)
        assert n["clave"] == "diamante" and n["siguiente"] is None

    def test_progreso_intermedio(self):
        rows = [{"monto": 200, "moneda": "PEN", "estado": "completada"}]
        n = calcular_nivel(rows)  # bronce (100) rumbo a plata (300)
        assert n["siguiente"]["progreso_pct"] == 50.0

    def test_escala_ordenada(self):
        umbrales = [n[2] for n in NIVELES]
        assert umbrales == sorted(umbrales)


class TestFinanzas:
    def test_matematica_completa(self, db):
        org = datos.organizacion(db)
        for estado, monto in [("completada", 100), ("confirmada", 60),
                              ("pendiente", 999), ("fallida", 999)]:
            datos.donacion(db, id_organizacion=org["id"], monto=monto, estado=estado)
        datos.retiro(db, id_organizacion=org["id"], monto=40, estado="completado")
        datos.retiro(db, id_organizacion=org["id"], monto=30, estado="pendiente")
        datos.retiro(db, id_organizacion=org["id"], monto=999, estado="rechazado")

        f = calcular_finanzas(db, org["id"])["PEN"]
        assert f == {"recaudado": 160.0, "retirado": 40.0,
                     "comprometido": 30.0, "disponible": 90.0}

    def test_tabla_retiros_ausente_no_rompe(self, app, db):
        org = datos.organizacion(db)
        datos.donacion(db, id_organizacion=org["id"], monto=10)
        db.faltantes.add("retiros")
        with app.app_context():
            f = calcular_finanzas(db, org["id"])["PEN"]
        assert f["recaudado"] == 10.0 and f["disponible"] == 10.0

    def test_resumen_donaciones(self):
        rows = [
            {"estado": "completada", "moneda": "PEN", "monto": 10},
            {"estado": "confirmada", "moneda": "PEN", "monto": 5},
            {"estado": "pendiente", "moneda": "PEN", "monto": 99},
        ]
        r = resumen_donaciones(rows)
        assert r["totales_completadas"]["PEN"] == 15.0
        assert r["por_estado"] == {"completada": 1, "confirmada": 1, "pendiente": 1}


class TestGeo:
    def test_departamentos(self):
        assert departamento_de("010101") == "Amazonas"
        assert departamento_de(150101) == "Lima"
        assert departamento_de("") == "Perú"
        assert len(DEPARTAMENTOS) == 25


class TestStorage:
    PNG = base64.b64encode(b"\x89PNG-fake-bytes").decode()

    def test_subida_ok_url_con_cachebust(self, db):
        url = subir_avatar(db, "usuarios", "u1", self.PNG, "image/png")
        assert url.startswith("https://storage.fake/avatares/usuarios/u1.png?v=")
        assert "avatares/usuarios/u1.png" in db.storage.objetos

    def test_acepta_data_url(self, db):
        url = subir_avatar(db, "usuarios", "u2",
                           f"data:image/png;base64,{self.PNG}", "image/png")
        assert "u2.png" in url

    def test_base64_invalido(self, db):
        with pytest.raises(AvatarInvalido):
            subir_avatar(db, "usuarios", "u3", "!!!no-base64!!!", "image/png")

    def test_demasiado_grande(self, db):
        gigante = base64.b64encode(b"x" * 2_000_000).decode()
        with pytest.raises(AvatarInvalido):
            subir_avatar(db, "usuarios", "u4", gigante, "image/jpeg")


class TestFeed:
    def test_publica_evento(self, app, db):
        from services.feed import publicar_evento
        with app.app_context():
            publicar_evento(db, "donacion", "Nueva donación en Lima",
                            mensaje="Alguien apoyó", departamento="Lima",
                            monto=25, moneda="PEN")
        ev = db.data["eventos_feed"][0]
        assert ev["titulo"] == "Nueva donación en Lima" and ev["monto"] == 25

    def test_tabla_ausente_no_tumba_flujo(self, app, db):
        from services.feed import publicar_evento
        db.faltantes.add("eventos_feed")
        with app.app_context():
            publicar_evento(db, "donacion", "titulo")  # no debe lanzar
        assert db.data["eventos_feed"] == []
