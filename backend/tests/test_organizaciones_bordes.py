"""Casos borde de organizaciones: avatar, edición de métodos de cobro,
metas departamentales y accesos sin organización registrada."""
import base64

from tests import test_data as datos

B64 = base64.b64encode(b"png-falso").decode()


def _org_user(db, **kw):
    u = datos.usuario(db, rol="organizacion")
    org = datos.organizacion(db, user_id=u["id"], **kw)
    return u, org


class TestAvatarOrganizacion:
    def test_subida_ok(self, client, db, auth):
        u, org = _org_user(db)
        r = client.post("/api/mi-organizacion/avatar",
                        json={"imagen_base64": B64, "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 200
        url = r.get_json()["avatar_url"]
        assert f"organizaciones/{org['id']}" in url
        assert db.data["organizaciones"][0]["avatar_url"] == url

    def test_suspendida_no_cambia_avatar(self, client, db, auth):
        u, _ = _org_user(db, estado="suspendido")
        r = client.post("/api/mi-organizacion/avatar",
                        json={"imagen_base64": B64, "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 403

    def test_sin_org_404(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        r = client.post("/api/mi-organizacion/avatar",
                        json={"imagen_base64": B64, "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 404

    def test_imagen_corrupta_400(self, client, db, auth):
        u, _ = _org_user(db)
        r = client.post("/api/mi-organizacion/avatar",
                        json={"imagen_base64": "###", "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 400


class TestEditarMetodoCobro:
    def test_put_actualiza(self, client, db, auth):
        u, org = _org_user(db)
        m = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "yape", "titular": "Maria Perez", "yape_numero": "987654321",
        }, headers=auth(u)).get_json()["data"]
        r = client.put(f"/api/mi-organizacion/metodos-cobro/{m['id']}", json={
            "tipo": "yape", "titular": "Maria Perez Vda",
            "yape_numero": "912345678", "principal": True,
        }, headers=auth(u))
        assert r.status_code == 200
        actualizado = db.data["metodos_cobro"][0]
        assert actualizado["yape_numero"] == "912345678"
        assert actualizado["principal"] is True

    def test_put_metodo_inexistente_404(self, client, db, auth):
        u, _ = _org_user(db)
        r = client.put("/api/mi-organizacion/metodos-cobro/99999999-0000-0000-0000-000000000000",
                       json={"tipo": "yape", "titular": "Maria Perez",
                             "yape_numero": "987654321"},
                       headers=auth(u))
        assert r.status_code == 404

    def test_put_uuid_invalido_400(self, client, db, auth):
        u, _ = _org_user(db)
        r = client.put("/api/mi-organizacion/metodos-cobro/xx",
                       json={"tipo": "yape", "titular": "Maria Perez",
                             "yape_numero": "987654321"},
                       headers=auth(u))
        assert r.status_code == 400

    def test_put_payload_invalido_400(self, client, db, auth):
        u, _ = _org_user(db)
        m = client.post("/api/mi-organizacion/metodos-cobro", json={
            "tipo": "yape", "titular": "Maria Perez", "yape_numero": "987654321",
        }, headers=auth(u)).get_json()["data"]
        r = client.put(f"/api/mi-organizacion/metodos-cobro/{m['id']}",
                       json={"tipo": "banco", "titular": "Maria"},
                       headers=auth(u))
        assert r.status_code == 400

    def test_listado_sin_tabla_devuelve_vacio(self, client, db, auth):
        u, _ = _org_user(db)
        db.faltantes.add("metodos_cobro")
        r = client.get("/api/mi-organizacion/metodos-cobro", headers=auth(u))
        assert r.get_json()["data"] == []


class TestSinOrganizacion:
    RUTAS_GET = ["/api/mi-organizacion/finanzas", "/api/mi-organizacion/retiros",
                 "/api/mi-organizacion/donaciones",
                 "/api/mi-organizacion/metodos-cobro"]

    def test_gets_devuelven_404(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        for ruta in self.RUTAS_GET:
            assert client.get(ruta, headers=auth(u)).status_code == 404, ruta

    def test_mi_organizacion_devuelve_null(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        r = client.get("/api/mi-organizacion", headers=auth(u))
        assert r.status_code == 200 and r.get_json()["data"] is None

    def test_put_sin_org_404(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        r = client.put("/api/mi-organizacion", json={"nivel_necesidad": 5},
                       headers=auth(u))
        assert r.status_code == 404

    def test_meta_sin_org_404(self, client, db, auth):
        u = datos.usuario(db, rol="organizacion")
        r = client.post("/api/mi-organizacion/meta",
                        json={"titulo": "Meta", "objetivo_monto": 100},
                        headers=auth(u))
        assert r.status_code == 404


class TestMetasAvanzadas:
    def test_meta_departamental_suma_orgs_del_depto(self, client, db):
        lima1 = datos.organizacion(db, ubigeo="150101")
        lima2 = datos.organizacion(db, ubigeo="150102", nombre="Otra Lima")
        cusco = datos.organizacion(db, ubigeo="080101", nombre="Cusco Org")
        datos.donacion(db, id_organizacion=lima1["id"], monto=60)
        datos.donacion(db, id_organizacion=lima2["id"], monto=40)
        datos.donacion(db, id_organizacion=cusco["id"], monto=999)
        db.data["metas"].append({
            "id": "aaaaaaaa-0000-0000-0000-00000000000d", "tipo": "departamento",
            "id_organizacion": None, "departamento": "15", "titulo": "Meta Lima",
            "descripcion": None, "objetivo_monto": 200, "moneda": "PEN",
            "fecha_inicio": "2026-01-01T00:00:00+00:00", "fecha_fin": None,
            "activa": True,
        })
        metas = client.get("/api/metas").get_json()["data"]
        assert metas[0]["recaudado"] == 100.0
        assert metas[0]["progreso_pct"] == 50.0
        assert metas[0]["departamento_nombre"] == "Lima"

    def test_meta_org_incluye_nombre(self, client, db):
        org = datos.organizacion(db, nombre="Con Meta")
        db.data["metas"].append({
            "id": "aaaaaaaa-0000-0000-0000-00000000000e", "tipo": "organizacion",
            "id_organizacion": org["id"], "departamento": None,
            "titulo": "Meta propia", "descripcion": None, "objetivo_monto": 100,
            "moneda": "PEN", "fecha_inicio": "2026-01-01T00:00:00+00:00",
            "fecha_fin": None, "activa": True,
        })
        metas = client.get("/api/metas").get_json()["data"]
        assert metas[0]["organizacion_nombre"] == "Con Meta"

    def test_sin_metas_lista_vacia(self, client, db):
        assert client.get("/api/metas").get_json()["data"] == []

    def test_desactivar_sin_meta_activa_ok(self, client, db, auth):
        u, _ = _org_user(db)
        r = client.post("/api/mi-organizacion/meta",
                        json={"titulo": "cerrar", "objetivo_monto": 1,
                              "activa": False},
                        headers=auth(u))
        assert r.status_code == 200 and r.get_json()["data"] is None

    def test_meta_org_suspendida_403(self, client, db, auth):
        u, _ = _org_user(db, estado="suspendido")
        r = client.post("/api/mi-organizacion/meta",
                        json={"titulo": "Meta", "objetivo_monto": 100},
                        headers=auth(u))
        assert r.status_code == 403

    def test_finanzas_incluye_meta_con_progreso(self, client, db, auth):
        u, org = _org_user(db)
        datos.donacion(db, id_organizacion=org["id"], monto=50)
        db.data["metas"].append({
            "id": "aaaaaaaa-0000-0000-0000-00000000000f", "tipo": "organizacion",
            "id_organizacion": org["id"], "departamento": None,
            "titulo": "Meta viva", "descripcion": None, "objetivo_monto": 100,
            "moneda": "PEN", "fecha_inicio": "2026-01-01T00:00:00+00:00",
            "fecha_fin": None, "activa": True,
        })
        cuerpo = client.get("/api/mi-organizacion/finanzas",
                            headers=auth(u)).get_json()
        assert cuerpo["meta"]["progreso_pct"] == 50.0
