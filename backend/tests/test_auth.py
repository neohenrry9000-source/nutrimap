"""Auth: registro, login, logout, perfil, avatar y bloqueos de cuenta."""
import base64

from tests import test_data as datos
from tests.conftest import ORIGIN


def registrar(client, email="nuevo@test.pe", rol="donador"):
    return client.post("/api/register", json={
        "email": email, "password": "ClaveSegura123",
        "rol": rol, "nombre": "Nuevo Usuario",
    }, headers={"Origin": ORIGIN})


class TestRegistro:
    def test_registro_ok(self, client, db):
        r = registrar(client)
        assert r.status_code == 201
        u = db.data["usuarios"][0]
        assert u["email"] == "nuevo@test.pe"
        assert u["password_hash"] != "ClaveSegura123"  # nunca en claro

    def test_email_duplicado(self, client, db):
        registrar(client)
        assert registrar(client).status_code == 409

    def test_payload_invalido(self, client, db):
        r = client.post("/api/register", json={"email": "x@y.pe", "password": "corta"},
                        headers={"Origin": ORIGIN})
        assert r.status_code == 400


class TestLogin:
    def test_login_ok_setea_cookie_httponly(self, client, db):
        registrar(client)
        r = client.post("/api/login", json={"email": "nuevo@test.pe",
                                            "password": "ClaveSegura123"},
                        headers={"Origin": ORIGIN})
        assert r.status_code == 200 and r.get_json()["rol"] == "donador"
        cookie = r.headers.get("Set-Cookie", "")
        assert "nm_token=" in cookie and "HttpOnly" in cookie

    def test_password_incorrecta_401_y_auditada(self, client, db):
        registrar(client)
        r = client.post("/api/login", json={"email": "nuevo@test.pe",
                                            "password": "incorrecta999"},
                        headers={"Origin": ORIGIN})
        assert r.status_code == 401
        intentos = db.data["intentos_login"]
        assert intentos and intentos[-1]["exito"] is False

    def test_baneado_no_entra_ni_con_password_correcta(self, client, db):
        registrar(client)
        db.data["usuarios"][0]["estado"] = "baneado"
        r = client.post("/api/login", json={"email": "nuevo@test.pe",
                                            "password": "ClaveSegura123"},
                        headers={"Origin": ORIGIN})
        assert r.status_code == 403
        assert r.get_json()["error"] == "cuenta_bloqueada"

    def test_suspendido_si_puede_entrar(self, client, db):
        registrar(client)
        db.data["usuarios"][0]["estado"] = "suspendido"
        r = client.post("/api/login", json={"email": "nuevo@test.pe",
                                            "password": "ClaveSegura123"},
                        headers={"Origin": ORIGIN})
        assert r.status_code == 200

    def test_logout_borra_cookie(self, client, db):
        r = client.post("/api/logout", headers={"Origin": ORIGIN})
        assert r.status_code == 200
        assert "nm_token=;" in r.headers.get("Set-Cookie", "").replace(" ", "")


class TestPerfil:
    def test_me_sin_token_401(self, client, db):
        assert client.get("/api/me").status_code == 401

    def test_me_nunca_expone_password_hash(self, client, db, auth):
        u = datos.usuario(db)
        r = client.get("/api/me", headers=auth(u))
        assert r.status_code == 200
        cuerpo = r.get_json()["data"]
        assert "password_hash" not in cuerpo and cuerpo["email"] == u["email"]

    def test_actualizar_nombre(self, client, db, auth):
        u = datos.usuario(db)
        r = client.put("/api/mi-perfil", json={"nombre": "Nombre Nuevo"},
                       headers=auth(u))
        assert r.status_code == 200
        assert db.data["usuarios"][0]["nombre"] == "Nombre Nuevo"

    def test_suspendido_no_edita_perfil(self, client, db, auth):
        u = datos.usuario(db, estado="suspendido")
        r = client.put("/api/mi-perfil", json={"nombre": "X Y"}, headers=auth(u))
        assert r.status_code == 403
        assert r.get_json()["error"] == "cuenta_suspendida"


class TestAvatar:
    B64 = base64.b64encode(b"\x89PNG\r\n\x1a\nfake-png-content").decode()

    def test_subida_ok_y_persistida(self, client, db, auth):
        u = datos.usuario(db)
        r = client.post("/api/mi-avatar",
                        json={"imagen_base64": self.B64, "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 200
        url = r.get_json()["avatar_url"]
        assert url.startswith("https://storage.fake/avatares/usuarios/")
        assert db.data["usuarios"][0]["avatar_url"] == url

    def test_imagen_corrupta_400(self, client, db, auth):
        u = datos.usuario(db)
        r = client.post("/api/mi-avatar",
                        json={"imagen_base64": "###no-base64###", "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 400

    def test_baneado_no_sube_avatar(self, client, db, auth):
        u = datos.usuario(db, estado="baneado")
        r = client.post("/api/mi-avatar",
                        json={"imagen_base64": self.B64, "mime": "image/png"},
                        headers=auth(u))
        assert r.status_code == 403
        assert r.get_json()["error"] == "cuenta_bloqueada"
