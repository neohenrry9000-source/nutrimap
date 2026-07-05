"""Mapa público, stats globales, CSRF por Origin y headers de seguridad."""
from tests import test_data as datos
from tests.conftest import ORIGIN


class TestMapa:
    def test_normaliza_ubigeo_y_une_orgs(self, client, db):
        datos.distrito_mapa(db, ubigeo="10101")  # BD vieja: sin cero inicial
        datos.organizacion(db, ubigeo="010101", nombre="Olla Chachapoyas")
        filas = client.get("/api/mapa").get_json()["data"]
        assert filas[0]["ubigeo"] == "010101"
        assert filas[0]["organizaciones"][0]["nombre"] == "Olla Chachapoyas"
        # proyección pública: sin datos de contacto
        assert "telefono" not in filas[0]["organizaciones"][0]

    def test_adjunta_oferta_social(self, client, db):
        datos.distrito_mapa(db)
        db.data["oferta_social"].append({
            "id": 1, "ubigeo": "150101", "localidad": "Lima Centro",
            "tipo": "comedor_popular", "hogares_usan_comedor": 8,
            "uso_comedor_pct": 20.0, "fuente": "ENDES",
        })
        fila = client.get("/api/mapa").get_json()["data"][0]
        assert fila["oferta_social"]["localidad"] == "Lima Centro"

    def test_sin_tabla_oferta_social_sigue_ok(self, client, db):
        datos.distrito_mapa(db)
        db.faltantes.add("oferta_social")
        fila = client.get("/api/mapa").get_json()["data"][0]
        assert fila["oferta_social"] is None

    def test_stats_globales(self, client, db):
        org = datos.organizacion(db)
        datos.organizacion(db, ubigeo="020101", nombre="Otra Región")
        datos.donacion(db, id_organizacion=org["id"], monto=70)
        datos.donacion(db, id_organizacion=org["id"], monto=30,
                       estado="rechazada")
        d = client.get("/api/stats").get_json()["data"]
        assert d["total_donado"] == {"PEN": 70.0}
        assert d["donaciones"] == 1
        assert d["organizaciones_activas"] == 2
        assert d["departamentos_con_orgs"] == 2


class TestSeguridadHTTP:
    def test_origin_malicioso_bloqueado(self, client, db):
        r = client.post("/api/login", json={"email": "a@b.pe", "password": "x"},
                        headers={"Origin": f"{ORIGIN}.evil.com"})
        assert r.status_code == 403

    def test_origin_permitido_pasa(self, client, db):
        r = client.post("/api/login", json={"email": "a@b.pe", "password": "xyzxyzxyz"},
                        headers={"Origin": ORIGIN})
        assert r.status_code in (400, 401)  # llegó al handler, no al firewall

    def test_get_sin_origin_ok(self, client, db):
        assert client.get("/api/health").status_code == 200

    def test_headers_de_seguridad_presentes(self, client, db):
        r = client.get("/api/health")
        assert r.headers["X-Frame-Options"] == "DENY"
        assert r.headers["X-Content-Type-Options"] == "nosniff"
        assert r.headers["Referrer-Policy"] == "no-referrer"
        assert "geolocation=()" in r.headers["Permissions-Policy"]

    def test_404_json_sin_stacktrace(self, client, db):
        r = client.get("/api/no-existe")
        assert r.status_code == 404
        assert r.get_json() == {"error": "not_found"}
