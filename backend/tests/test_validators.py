"""Validaciones Pydantic: la primera línea de defensa de la API."""
import pytest
from pydantic import ValidationError

from validators.schemas import (AvatarIn, DonarIn, MetaIn, MetodoCobroIn,
                                ModeracionIn, OrgIn, OrgUpdateIn, PerfilUpdateIn,
                                RegisterIn, RetiroAccionIn, RetiroIn)

ORG_UUID = "11111111-2222-3333-4444-555555555555"


class TestDonarIn:
    def base(self, **kw):
        return {"id_organizacion": ORG_UUID, "monto": 50, **kw}

    def test_tarjeta_valida_normaliza_pan(self):
        d = DonarIn(**self.base(card_number="4111 1111 1111 1111",
                                card_exp="12/28", card_cvv="123"))
        assert d.card_number == "4111111111111111"
        assert d.metodo_pago == "tarjeta" and d.es_anonima is False

    @pytest.mark.parametrize("campo,valor", [
        ("card_number", "1234"), ("card_exp", "13-28"), ("card_cvv", "12"),
    ])
    def test_tarjeta_invalida(self, campo, valor):
        datos = self.base(card_number="4111111111111111",
                          card_exp="12/28", card_cvv="123")
        datos[campo] = valor
        with pytest.raises(ValidationError):
            DonarIn(**datos)

    def test_tarjeta_sin_datos_de_tarjeta_falla(self):
        with pytest.raises(ValidationError):
            DonarIn(**self.base())

    def test_yape_no_requiere_tarjeta(self):
        d = DonarIn(**self.base(metodo_pago="yape", es_anonima=True))
        assert d.metodo_pago == "yape" and d.es_anonima is True

    @pytest.mark.parametrize("monto", [0, -5, 100001])
    def test_monto_fuera_de_rango(self, monto):
        with pytest.raises(ValidationError):
            DonarIn(**self.base(monto=monto, metodo_pago="yape"))

    def test_uuid_organizacion_invalido(self):
        with pytest.raises(ValidationError):
            DonarIn(id_organizacion="no-es-uuid", monto=10, metodo_pago="yape")


class TestOrg:
    def test_org_completa(self):
        o = OrgIn(nombre="Comedor Santa Rosa", ubigeo="150101",
                  telefono="+51 999888777", ruc="20123456789",
                  email_contacto="c@x.pe", direccion="Jr. Uno 123",
                  cobertura="80 familias")
        assert o.ruc == "20123456789"

    @pytest.mark.parametrize("kw", [
        {"nombre": "ab"}, {"ubigeo": "15010"}, {"ubigeo": "abcdef"},
        {"ruc": "123"}, {"telefono": "abc"}, {"nivel_necesidad": 9},
    ])
    def test_org_invalida(self, kw):
        base = {"nombre": "Comedor Valido", "ubigeo": "150101"}
        with pytest.raises(ValidationError):
            OrgIn(**{**base, **kw})

    def test_update_parcial_solo_enviados(self):
        u = OrgUpdateIn(descripcion="nueva")
        assert u.model_dump(exclude_unset=True) == {"descripcion": "nueva"}


class TestMetodoCobro:
    def test_banco_valido(self):
        m = MetodoCobroIn(tipo="banco", titular="Maria Perez", banco="BCP",
                          numero_cuenta="123-456789", cci="0" * 20)
        assert m.tipo == "banco"

    def test_banco_sin_cuenta_falla(self):
        with pytest.raises(ValidationError):
            MetodoCobroIn(tipo="banco", titular="Maria Perez", banco="BCP")

    def test_yape_valido(self):
        assert MetodoCobroIn(tipo="yape", titular="Maria Perez",
                             yape_numero="987654321").yape_numero == "987654321"

    @pytest.mark.parametrize("num", ["12345678", "887654321", "9876543210"])
    def test_yape_numero_invalido(self, num):
        with pytest.raises(ValidationError):
            MetodoCobroIn(tipo="yape", titular="Maria Perez", yape_numero=num)


class TestOtros:
    def test_registro_password_corta(self):
        with pytest.raises(ValidationError):
            RegisterIn(email="a@b.pe", password="corta")

    def test_registro_no_permite_rol_admin(self):
        with pytest.raises(ValidationError):
            RegisterIn(email="a@b.pe", password="0123456789", rol="admin")

    def test_retiro_accion(self):
        assert RetiroAccionIn(accion="aprobar").nota == ""
        with pytest.raises(ValidationError):
            RetiroAccionIn(accion="destruir")

    def test_retiro_monto_positivo(self):
        with pytest.raises(ValidationError):
            RetiroIn(monto=0)

    def test_moderacion_motivo_obligatorio(self):
        with pytest.raises(ValidationError):
            ModeracionIn(tipo="usuario", id=ORG_UUID, accion="banear", motivo="x")
        m = ModeracionIn(tipo="organizacion", id=ORG_UUID,
                         accion="suspender", motivo="fraude verificado")
        assert m.accion == "suspender"

    def test_avatar_mime_restringido(self):
        with pytest.raises(ValidationError):
            AvatarIn(imagen_base64="x" * 20, mime="image/gif")

    def test_meta_objetivo_positivo(self):
        with pytest.raises(ValidationError):
            MetaIn(titulo="Meta", objetivo_monto=0)

    def test_perfil_nombre_no_vacio(self):
        with pytest.raises(ValidationError):
            PerfilUpdateIn(nombre="")
