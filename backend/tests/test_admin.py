"""Panel admin: protección por rol, retiros, resumen y moderación."""
from tests import test_data as datos
from tests.conftest import ORIGIN


class TestProteccion:
    RUTAS = ["/api/admin/resumen", "/api/admin/retiros", "/api/admin/usuarios",
             "/api/admin/organizaciones"]

    def test_sin_sesion_401(self, client, db):
        for ruta in self.RUTAS:
            assert client.get(ruta).status_code == 401, ruta

    def test_donador_403(self, client, db, auth):
        h = auth(datos.usuario(db))
        for ruta in self.RUTAS:
            assert client.get(ruta, headers=h).status_code == 403, ruta

    def test_org_403_en_moderar(self, client, db, auth):
        h = auth(datos.usuario(db, rol="organizacion"))
        r = client.post("/api/admin/moderar", json={}, headers=h)
        assert r.status_code == 403


class TestResumen:
    def test_metricas(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        datos.usuario(db)
        org = datos.organizacion(db)
        datos.organizacion(db, nombre="Inactiva", ubigeo="020101", activa=False)
        datos.donacion(db, id_organizacion=org["id"], monto=100)
        datos.donacion(db, id_organizacion=org["id"], monto=50, estado="pendiente")
        datos.retiro(db, id_organizacion=org["id"], monto=30, estado="completado")
        datos.retiro(db, id_organizacion=org["id"], monto=10)

        d = client.get("/api/admin/resumen", headers=auth(admin)).get_json()["data"]
        assert d["total_donado"] == {"PEN": 100.0}
        assert d["total_retirado"] == {"PEN": 30.0}
        assert d["retiros_pendientes"] == 1
        assert d["organizaciones"] == 2 and d["organizaciones_activas"] == 1
        assert d["donadores"] == 1 and d["admins"] == 1


class TestRetirosAdmin:
    def _setup(self, db):
        admin = datos.usuario(db, rol="admin")
        org = datos.organizacion(db)
        datos.donacion(db, id_organizacion=org["id"], monto=500)
        ret = datos.retiro(db, id_organizacion=org["id"], monto=100)
        return admin, org, ret

    def test_listado_enriquecido(self, client, db, auth):
        admin, org, ret = self._setup(db)
        db.data["metodos_cobro"].append({
            "id": "bbbbbbbb-0000-0000-0000-000000000001",
            "id_organizacion": org["id"], "tipo": "yape",
            "titular": "Maria", "yape_numero": "987654321", "principal": True,
            "created_at": "2026-01-01T00:00:00+00:00",
        })
        filas = client.get("/api/admin/retiros",
                           headers=auth(admin)).get_json()["data"]
        assert filas[0]["disponible_org"] == 400.0  # 500 - 100 comprometido
        assert filas[0]["organizacion"]["nombre"] == org["nombre"]
        assert filas[0]["metodos_cobro"][0]["yape_numero"] == "987654321"

    def test_filtro_estado_invalido_400(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        assert client.get("/api/admin/retiros?estado=zzz",
                          headers=auth(admin)).status_code == 400

    def test_ciclo_completo_transiciones(self, client, db, auth):
        admin, org, ret = self._setup(db)
        h = auth(admin)
        for accion, esperado in [("observar", "observado"), ("aprobar", "aprobado"),
                                 ("completar", "completado")]:
            r = client.post(f"/api/admin/retiros/{ret['id']}",
                            json={"accion": accion, "nota": f"paso {accion}"},
                            headers=h)
            assert r.status_code == 200
            d = r.get_json()["data"]
            assert d["estado"] == esperado
            assert d["procesado_por"] == admin["id"]
            assert d["fecha_procesamiento"]
        # trazabilidad en auditoría
        acciones = [a["accion"] for a in db.data["auditoria_eventos"]]
        assert acciones == ["retiro_observar", "retiro_aprobar", "retiro_completar"]

    def test_transicion_invalida_409(self, client, db, auth):
        admin, org, ret = self._setup(db)
        r = client.post(f"/api/admin/retiros/{ret['id']}",
                        json={"accion": "completar", "nota": "directo"},
                        headers=auth(admin))
        assert r.status_code == 409  # pendiente no puede completarse directo

    def test_retiro_inexistente_404(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        r = client.post("/api/admin/retiros/99999999-0000-0000-0000-000000000000",
                        json={"accion": "aprobar"}, headers=auth(admin))
        assert r.status_code == 404


class TestModeracion:
    def test_listar_usuarios_sin_password_y_con_filtros(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        datos.usuario(db, email="malo@test.pe", estado="baneado")
        datos.usuario(db, email="bueno@test.pe")
        h = auth(admin)

        todos = client.get("/api/admin/usuarios", headers=h).get_json()["data"]
        assert all("password_hash" not in u for u in todos)

        baneados = client.get("/api/admin/usuarios?estado=baneado",
                              headers=h).get_json()["data"]
        assert [u["email"] for u in baneados] == ["malo@test.pe"]

        buscado = client.get("/api/admin/usuarios?q=bueno",
                             headers=h).get_json()["data"]
        assert [u["email"] for u in buscado] == ["bueno@test.pe"]

    def test_listar_organizaciones_con_dueno(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        dueno = datos.usuario(db, rol="organizacion", email="dueno@test.pe")
        datos.organizacion(db, user_id=dueno["id"], estado="suspendido")
        filas = client.get("/api/admin/organizaciones?estado=suspendido",
                           headers=auth(admin)).get_json()["data"]
        assert filas[0]["dueno_email"] == "dueno@test.pe"
        assert filas[0]["departamento"] == "Lima"

    def test_suspender_banear_reactivar_usuario(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        objetivo = datos.usuario(db)
        h = auth(admin)

        for accion, estado in [("suspender", "suspendido"), ("banear", "baneado"),
                               ("reactivar", "activo")]:
            r = client.post("/api/admin/moderar", json={
                "tipo": "usuario", "id": objetivo["id"],
                "accion": accion, "motivo": f"motivo de {accion} verificado",
            }, headers=h)
            assert r.status_code == 200, r.get_json()
            assert r.get_json()["data"]["estado"] == estado
            assert "password_hash" not in r.get_json()["data"]

        eventos = db.data["moderacion_eventos"]
        assert [e["accion"] for e in eventos] == ["suspender", "banear", "reactivar"]
        assert eventos[0]["realizado_por"] == admin["id"]
        assert eventos[1]["estado_previo"] == "suspendido"

    def test_banear_organizacion_la_saca_del_publico(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        org = datos.organizacion(db, nombre="Org Fraude")
        datos.distrito_mapa(db)
        r = client.post("/api/admin/moderar", json={
            "tipo": "organizacion", "id": org["id"],
            "accion": "banear", "motivo": "fraude confirmado por reportes",
        }, headers=auth(admin))
        assert r.status_code == 200

        publico = client.get("/api/organizaciones").get_json()["data"]
        assert publico == []
        mapa = client.get("/api/mapa").get_json()["data"]
        assert mapa[0]["organizaciones"] == []

    def test_no_moderar_admins_ni_a_si_mismo(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        otro_admin = datos.usuario(db, rol="admin")
        h = auth(admin)
        for objetivo in (otro_admin, admin):
            r = client.post("/api/admin/moderar", json={
                "tipo": "usuario", "id": objetivo["id"],
                "accion": "banear", "motivo": "intento indebido",
            }, headers=h)
            assert r.status_code == 403
            assert r.get_json()["error"] == "no_moderable"

    def test_sin_cambio_409(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        objetivo = datos.usuario(db)  # ya activo
        r = client.post("/api/admin/moderar", json={
            "tipo": "usuario", "id": objetivo["id"],
            "accion": "reactivar", "motivo": "ya estaba activo",
        }, headers=auth(admin))
        assert r.status_code == 409

    def test_motivo_corto_400(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        objetivo = datos.usuario(db)
        r = client.post("/api/admin/moderar", json={
            "tipo": "usuario", "id": objetivo["id"],
            "accion": "banear", "motivo": "x",
        }, headers=auth(admin))
        assert r.status_code == 400

    def test_entidad_inexistente_404(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        r = client.post("/api/admin/moderar", json={
            "tipo": "organizacion", "id": "99999999-0000-0000-0000-000000000000",
            "accion": "banear", "motivo": "no existe pero valido",
        }, headers=auth(admin))
        assert r.status_code == 404

    def test_historial_de_moderacion(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        objetivo = datos.usuario(db)
        h = auth(admin)
        client.post("/api/admin/moderar", json={
            "tipo": "usuario", "id": objetivo["id"],
            "accion": "suspender", "motivo": "primer strike documentado",
        }, headers=h)
        eventos = client.get(f"/api/admin/moderacion/usuario/{objetivo['id']}",
                             headers=h).get_json()["data"]
        assert len(eventos) == 1
        assert eventos[0]["motivo"] == "primer strike documentado"

    def test_historial_tipo_invalido_400(self, client, db, auth):
        admin = datos.usuario(db, rol="admin")
        r = client.get("/api/admin/moderacion/alien/99999999-0000-0000-0000-000000000000",
                       headers=auth(admin))
        assert r.status_code == 400

    def test_usuario_baneado_pierde_acceso_inmediato(self, client, db, auth):
        """El JWT sigue vivo, pero el estado en BD manda."""
        admin = datos.usuario(db, rol="admin")
        objetivo = datos.usuario(db)
        org = datos.organizacion(db)
        h_objetivo = auth(objetivo)  # token emitido ANTES del baneo

        client.post("/api/admin/moderar", json={
            "tipo": "usuario", "id": objetivo["id"],
            "accion": "banear", "motivo": "fraude con tarjetas reportado",
        }, headers=auth(admin))

        r = client.post("/api/donar", json={
            "id_organizacion": org["id"], "monto": 10, "metodo_pago": "yape",
        }, headers=h_objetivo)
        assert r.status_code == 403
        assert r.get_json()["error"] == "cuenta_bloqueada"
