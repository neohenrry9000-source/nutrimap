"""Organizaciones: registro único, moderación, métodos de cobro,
retiros, metas y finanzas."""
from tests import test_data as datos
from tests.conftest import ORIGIN


def crear_org(client, hdrs, **extra):
    return client.post("/api/organizaciones", json={
        "nombre": "Comedor Central", "ubigeo": "150101",
        "tipo": "comedor_popular", "nivel_necesidad": 4, **extra,
    }, headers=hdrs)


class TestRegistro:
    def test_crear_y_evento_feed(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        r = crear_org(client, auth(u))
        assert r.status_code == 201
        assert r.get_json()["data"]["user_id"] == u["id"]
        assert "Comedor Central" in db.data["eventos_feed"][0]["mensaje"]

    def test_registro_unico_por_usuario(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        crear_org(client, auth(u))
        r = crear_org(client, auth(u), nombre="Otra Distinta", ubigeo="020101")
        assert r.status_code == 409
        assert r.get_json()["error"] == "ya_tienes_organizacion"

    def test_nombre_duplicado_en_distrito_409(self, client, db, auth):
        crear_org(client, auth(datos.usuario(db, rol="organizacion")))
        r = crear_org(client, auth(datos.usuario(db, rol="organizacion")),
                      nombre="comedor central")  # case-insensitive
        assert r.status_code == 409
        assert r.get_json()["error"] == "organizacion_duplicada"

    def test_donador_no_crea_org(self, client, db, auth):
        assert crear_org(client, auth(datos.usuario(db))).status_code == 403

    def test_usuario_suspendido_no_crea_org(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion", estado="suspendido")
        assert crear_org(client, auth(u)).status_code == 403


class TestListadoPublico:
    def test_excluye_moderadas_y_datos_privados(self, client, db):
        datos.organizacion(db, nombre="Visible", telefono="999888777",
                           ruc="20123456789", email_contacto="c@x.pe")
        datos.organizacion(db, nombre="Suspendida", ubigeo="020101",
                           estado="suspendido")
        datos.organizacion(db, nombre="Baneada", ubigeo="030101",
                           estado="baneado")
        r = client.get("/api/organizaciones")
        filas = r.get_json()["data"]
        assert [f["nombre"] for f in filas] == ["Visible"]
        # proyección pública: sin contacto/RUC/estado
        assert "telefono" not in filas[0] and "ruc" not in filas[0]
        assert "email_contacto" not in filas[0] and "estado" not in filas[0]

    def test_filtro_ubigeo_invalido(self, client, db):
        assert client.get("/api/organizaciones?ubigeo=12").status_code == 400

    def test_filtro_nivel_invalido(self, client, db):
        assert client.get("/api/organizaciones?nivel_min=abc").status_code == 400


class TestMiOrganizacion:
    def test_get_y_put(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        assert client.get("/api/mi-organizacion",
                          headers=auth(u)).get_json()["data"]["id"] == org["id"]
        r = client.put("/api/mi-organizacion",
                       json={"nivel_necesidad": 5, "telefono": "+51 987654321"},
                       headers=auth(u))
        assert r.status_code == 200
        assert db.data["organizaciones"][0]["nivel_necesidad"] == 5

    def test_put_sin_cambios_400(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        datos.organizacion(db, user_id=u["id"])
        assert client.put("/api/mi-organizacion", json={},
                          headers=auth(u)).status_code == 400

    def test_org_suspendida_no_se_edita(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        datos.organizacion(db, user_id=u["id"], estado="suspendido")
        r = client.put("/api/mi-organizacion", json={"nivel_necesidad": 5},
                       headers=auth(u))
        assert r.status_code == 403
        assert r.get_json()["error"] == "organizacion_suspendida"

    def test_donaciones_recibidas_enmascara_anonimos(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        d1 = datos.usuario(db, nombre="Ana Visible")
        d2 = datos.usuario(db, nombre="Oculto Perez")
        datos.donacion(db, id_donante=d1["id"], id_organizacion=org["id"])
        datos.donacion(db, id_donante=d2["id"], id_organizacion=org["id"],
                       es_anonima=True, metodo_pago="yape", estado="confirmada")
        filas = client.get("/api/mi-organizacion/donaciones",
                           headers=auth(u)).get_json()["data"]
        nombres = {f["donante"] for f in filas}
        assert nombres == {"Ana Visible", "Donante anónimo"}
        assert not any("Oculto" in f["donante"] for f in filas)


class TestMetodosCobro:
    def test_crud_y_principal_unico(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        datos.organizacion(db, user_id=u["id"])
        h = auth(u)
        m1 = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "yape", "titular": "Maria Perez",
            "yape_numero": "987654321", "principal": True,
        }, headers=h).get_json()["data"]
        m2 = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "banco", "titular": "Maria Perez", "banco": "BCP",
            "numero_cuenta": "12345678", "principal": True,
        }, headers=h).get_json()["data"]

        filas = client.get("/api/mi-organizacion/metodos-cobro",
                           headers=h).get_json()["data"]
        principales = [f for f in filas if f["principal"]]
        assert len(filas) == 2 and len(principales) == 1
        assert principales[0]["id"] == m2["id"]  # el nuevo desplazó al anterior

        assert client.delete(f"/api/mi-organizacion/metodos-cobro/{m1['id']}",
                             headers=h).status_code == 200
        assert len(db.data["metodos_cobro"]) == 1

    def test_no_borra_metodo_ajeno(self, client, db, auth):
        u1 = datos.usuario(db, rol="organizacion")
        org1 = datos.organizacion(db, user_id=u1["id"])
        u2 = datos.usuario(db, rol="organizacion")
        datos.organizacion(db, user_id=u2["id"], nombre="Otra", ubigeo="020101")
        m = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "yape", "titular": "Maria Perez", "yape_numero": "987654321",
        }, headers=auth(u1)).get_json()["data"]
        assert client.delete(f"/api/mi-organizacion/metodos-cobro/{m['id']}",
                             headers=auth(u2)).status_code == 404

    def test_org_suspendida_no_gestiona_cobros(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        datos.organizacion(db, user_id=u["id"], estado="suspendido")
        r = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "yape", "titular": "Maria Perez", "yape_numero": "987654321",
        }, headers=auth(u))
        assert r.status_code == 403


class TestRetiros:
    def _org_con_fondos(self, db, monto=200):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        datos.donacion(db, id_organizacion=org["id"], monto=monto)
        return u, org

    def test_solicitud_valida(self, client, db, auth):
        u, org = self._org_con_fondos(db)
        r = client.post("/api/mi-organizacion/retiros",
                        json={"monto": 150, "nota": "compra de viveres"},
                        headers=auth(u))
        assert r.status_code == 201
        assert r.get_json()["data"]["estado"] == "pendiente"

    def test_sobregiro_409(self, client, db, auth):
        u, org = self._org_con_fondos(db, monto=100)
        datos.retiro(db, id_organizacion=org["id"], monto=80, estado="pendiente")
        r = client.post("/api/mi-organizacion/retiros", json={"monto": 30},
                        headers=auth(u))
        assert r.status_code == 409
        assert r.get_json()["error"] == "monto_excede_disponible"

    def test_org_suspendida_no_retira(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"], estado="suspendido")
        datos.donacion(db, id_organizacion=org["id"], monto=500)
        r = client.post("/api/mi-organizacion/retiros", json={"monto": 10},
                        headers=auth(u))
        assert r.status_code == 403

    def test_sin_organizacion_404(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        assert client.post("/api/mi-organizacion/retiros", json={"monto": 10},
                           headers=auth(u)).status_code == 404

    def test_listado_propio(self, client, db, auth):
        u, org = self._org_con_fondos(db)
        datos.retiro(db, id_organizacion=org["id"], estado="completado",
                     nota_admin="pagado")
        filas = client.get("/api/mi-organizacion/retiros",
                           headers=auth(u)).get_json()["data"]
        assert filas[0]["nota_admin"] == "pagado"


class TestMetasYFinanzas:
    def test_finanzas_endpoint(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        datos.donacion(db, id_organizacion=org["id"], monto=100)
        datos.retiro(db, id_organizacion=org["id"], monto=40, estado="completado")
        f = client.get("/api/mi-organizacion/finanzas",
                       headers=auth(u)).get_json()["finanzas"]["PEN"]
        assert f["disponible"] == 60.0

    def test_meta_crear_actualizar_desactivar(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        h = auth(u)
        r = client.post("/api/mi-organizacion/meta", json={
            "titulo": "100 menús", "objetivo_monto": 1000,
        }, headers=h)
        assert r.status_code == 201
        client.post("/api/mi-organizacion/meta", json={
            "titulo": "200 menús", "objetivo_monto": 2000,
        }, headers=h)
        activas = [m for m in db.data["metas"] if m["activa"]]
        assert len(activas) == 1 and activas[0]["titulo"] == "200 menús"

        client.post("/api/mi-organizacion/meta", json={
            "titulo": "x cerrar", "objetivo_monto": 1, "activa": False,
        }, headers=h)
        assert not any(m["activa"] for m in db.data["metas"])

    def test_metas_publicas_con_progreso(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        org = datos.organizacion(db, user_id=u["id"])
        db.data["metas"].append({
            "id": "aaaaaaaa-0000-0000-0000-000000000001", "tipo": "organizacion",
            "id_organizacion": org["id"], "departamento": None,
            "titulo": "Meta org", "descripcion": None, "objetivo_monto": 200,
            "moneda": "PEN", "fecha_inicio": "2026-01-01T00:00:00+00:00",
            "fecha_fin": None, "activa": True,
        })
        db.data["metas"].append({
            "id": "aaaaaaaa-0000-0000-0000-000000000002", "tipo": "global",
            "id_organizacion": None, "departamento": None,
            "titulo": "Meta global", "descripcion": None, "objetivo_monto": 1000,
            "moneda": "PEN", "fecha_inicio": "2026-01-01T00:00:00+00:00",
            "fecha_fin": None, "activa": True,
        })
        datos.donacion(db, id_organizacion=org["id"], monto=100)
        metas = client.get("/api/metas").get_json()["data"]
        por_tipo = {m["tipo"]: m for m in metas}
        assert por_tipo["organizacion"]["progreso_pct"] == 50.0
        assert por_tipo["global"]["recaudado"] == 100.0

    def test_top_excluye_moderadas(self, client, db):
        buena = datos.organizacion(db, nombre="Top Buena")
        mala = datos.organizacion(db, nombre="Top Baneada",
                                  ubigeo="020101", estado="baneado")
        datos.donacion(db, id_organizacion=buena["id"], monto=100)
        datos.donacion(db, id_organizacion=mala["id"], monto=900)
        top = client.get("/api/organizaciones/top").get_json()["data"]
        assert [t["nombre"] for t in top] == ["Top Buena"]
