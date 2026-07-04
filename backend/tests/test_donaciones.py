"""Donaciones: tarjeta, Yape, anonimato, feed, historial y bloqueos."""
from tests import test_data as datos
from tests.conftest import ORIGIN


def donar(client, hdrs, org_id, metodo="tarjeta", **extra):
    body = {"id_organizacion": org_id, "monto": 50, "moneda": "PEN",
            "metodo_pago": metodo, **extra}
    if metodo == "tarjeta":
        body.setdefault("card_number", "4111111111111111")
        body.setdefault("card_exp", "12/28")
        body.setdefault("card_cvv", "123")
    return client.post("/api/donar", json=body, headers=hdrs)


class TestDonarTarjeta:
    def test_completada_con_referencia_derivada(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db)
        r = donar(client, auth(donante), org["id"])
        assert r.status_code == 200
        d = r.get_json()["donacion"]
        assert d["estado"] == "completada"
        # PCI-DSS: nunca persistimos PAN/CVV, solo un hash derivado
        fila = db.data["donaciones"][0]
        assert "card_number" not in fila and "card_cvv" not in fila
        assert len(fila["referencia_pago"]) == 40

    def test_emite_evento_de_feed_publico(self, client, db, auth):
        donante = datos.usuario(db, nombre="Maria Gala")
        org = datos.organizacion(db, ubigeo="050101", nombre="Olla Ayacucho")
        donar(client, auth(donante), org["id"])
        ev = db.data["eventos_feed"][0]
        assert ev["departamento"] == "Ayacucho"
        assert "Maria Gala" in ev["mensaje"] and "Olla Ayacucho" in ev["mensaje"]

    def test_anonima_enmascara_en_feed(self, client, db, auth):
        donante = datos.usuario(db, nombre="Maria Gala")
        org = datos.organizacion(db)
        donar(client, auth(donante), org["id"], es_anonima=True)
        ev = db.data["eventos_feed"][0]
        assert "Donante anónimo" in ev["mensaje"]
        assert "Maria Gala" not in ev["mensaje"]
        # ...pero id_donante SIEMPRE queda para auditoría interna
        assert db.data["donaciones"][0]["id_donante"] == donante["id"]

    def test_org_inexistente_404(self, client, db, auth):
        donante = datos.usuario(db)
        r = donar(client, auth(donante), "99999999-0000-0000-0000-000000000000")
        assert r.status_code == 404

    def test_org_suspendida_no_recibe(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db, estado="suspendido")
        r = donar(client, auth(donante), org["id"])
        assert r.status_code == 409
        assert r.get_json()["error"] == "organizacion_no_disponible"

    def test_rol_organizacion_no_puede_donar(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db)
        assert donar(client, auth(u), org["id"]).status_code == 403

    def test_donador_suspendido_bloqueado(self, client, db, auth):
        donante = datos.usuario(db, estado="suspendido")
        org = datos.organizacion(db)
        r = donar(client, auth(donante), org["id"])
        assert r.status_code == 403
        assert r.get_json()["error"] == "cuenta_suspendida"

    def test_payload_invalido_400(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db)
        r = donar(client, auth(donante), org["id"], card_cvv="1")
        assert r.status_code == 400


class TestYape:
    def test_flujo_pendiente_confirmada(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db)
        r = donar(client, auth(donante), org["id"], metodo="yape")
        cuerpo = r.get_json()
        assert cuerpo["donacion"]["estado"] == "pendiente"
        assert cuerpo["yape"]["codigo"].startswith("YP-")
        assert len(cuerpo["yape"]["instrucciones"]) == 4
        assert db.data["eventos_feed"] == []  # aún no se anuncia

        rc = client.post(f"/api/donaciones/{cuerpo['donacion']['id']}/confirmar",
                         headers=auth(donante))
        assert rc.status_code == 200
        assert rc.get_json()["donacion"]["estado"] == "confirmada"
        assert "Yape" in db.data["eventos_feed"][0]["mensaje"]

    def test_no_confirma_donacion_ajena(self, client, db, auth):
        donante = datos.usuario(db)
        intruso = datos.usuario(db)
        org = datos.organizacion(db)
        don_id = donar(client, auth(donante), org["id"],
                       metodo="yape").get_json()["donacion"]["id"]
        assert client.post(f"/api/donaciones/{don_id}/confirmar",
                           headers=auth(intruso)).status_code == 404

    def test_no_confirma_tarjeta_ni_dos_veces(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db)
        don_id = donar(client, auth(donante), org["id"]).get_json()["donacion"]["id"]
        r = client.post(f"/api/donaciones/{don_id}/confirmar", headers=auth(donante))
        assert r.status_code == 409

    def test_uuid_invalido_400(self, client, db, auth):
        donante = datos.usuario(db)
        assert client.post("/api/donaciones/xx/confirmar",
                           headers=auth(donante)).status_code == 400


class TestHistorial:
    def test_mis_donaciones_con_resumen_y_nivel(self, client, db, auth):
        donante = datos.usuario(db)
        org = datos.organizacion(db, nombre="Comedor Norte")
        datos.donacion(db, id_donante=donante["id"], id_organizacion=org["id"],
                       monto=120, es_anonima=True)
        datos.donacion(db, id_donante=donante["id"], id_organizacion=org["id"],
                       monto=30, estado="pendiente", metodo_pago="yape")
        datos.donacion(db, id_donante=datos.usuario(db)["id"],
                       id_organizacion=org["id"])  # de otro: no debe salir

        r = client.get("/api/mis-donaciones", headers=auth(donante))
        cuerpo = r.get_json()
        assert len(cuerpo["data"]) == 2
        assert cuerpo["data"][0]["organizacion"] == "Comedor Norte"
        assert cuerpo["resumen"]["totales_completadas"]["PEN"] == 120.0
        assert cuerpo["nivel"]["clave"] == "bronce"  # 120 >= 100
        # el donador SÍ ve su propia donación anónima
        assert any(d["es_anonima"] for d in cuerpo["data"])


class TestFeedPublico:
    def test_devuelve_ultimos_eventos(self, client, db):
        for i in range(3):
            db.data["eventos_feed"].append({
                "id": i + 1, "tipo": "donacion", "titulo": f"Evento {i}",
                "mensaje": None, "departamento": "Lima", "monto": None,
                "moneda": None, "created_at": f"2026-06-0{i + 1}T00:00:00+00:00",
            })
        r = client.get("/api/feed")
        cuerpo = r.get_json()["data"]
        assert len(cuerpo) == 3 and cuerpo[0]["titulo"] == "Evento 2"  # desc

    def test_sin_tabla_devuelve_vacio(self, client, db):
        db.faltantes.add("eventos_feed")
        assert client.get("/api/feed").get_json()["data"] == []
