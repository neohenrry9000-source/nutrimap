"""
Validación con Pydantic v2. Convertimos cualquier ValidationError en un
400 limpio en cada route. Esto previene:
  * inyección por tipos inesperados
  * payloads gigantes
  * datos mal formados que rompan SQL/ORM
"""
import re
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    rol: Literal["donador", "organizacion"] = "donador"
    nombre: str = Field(default="", max_length=120)

    @field_validator("nombre")
    @classmethod
    def _sanitizar_nombre(cls, v: str) -> str:
        return re.sub(r"[<>\"'&]", "", v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class OrgIn(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    ubigeo: str = Field(pattern=r"^\d{6}$")
    lat: float | None = None
    lng: float | None = None
    nivel_necesidad: int = Field(ge=1, le=5, default=3)
    descripcion: str = Field(default="", max_length=500)
    tipo: Literal["olla_comun", "comedor_popular", "otro"] = "olla_comun"
    # Datos de contacto/identidad (opcionales; requieren el SQL de
    # evolucion_producto.sql en la BD)
    direccion: str | None = Field(default=None, max_length=200)
    telefono: str | None = Field(default=None, pattern=r"^[0-9+() -]{6,15}$")
    email_contacto: EmailStr | None = None
    ruc: str | None = Field(default=None, pattern=r"^\d{11}$")
    cobertura: str | None = Field(default=None, max_length=300)


class OrgUpdateIn(BaseModel):
    """Actualización parcial del perfil de organización.

    Todos los campos son opcionales; solo se aplican los enviados
    (exclude_unset). Mismas reglas que OrgIn.
    """
    nombre: str | None = Field(default=None, min_length=3, max_length=120)
    ubigeo: str | None = Field(default=None, pattern=r"^\d{6}$")
    lat: float | None = None
    lng: float | None = None
    nivel_necesidad: int | None = Field(default=None, ge=1, le=5)
    descripcion: str | None = Field(default=None, max_length=500)
    tipo: Literal["olla_comun", "comedor_popular", "otro"] | None = None
    activa: bool | None = None
    direccion: str | None = Field(default=None, max_length=200)
    telefono: str | None = Field(default=None, pattern=r"^[0-9+() -]{6,15}$")
    email_contacto: EmailStr | None = None
    ruc: str | None = Field(default=None, pattern=r"^\d{11}$")
    cobertura: str | None = Field(default=None, max_length=300)


class RetiroIn(BaseModel):
    monto: float = Field(gt=0, le=1_000_000)
    moneda: Literal["PEN", "USD"] = "PEN"
    nota: str = Field(default="", max_length=300)


class MetaIn(BaseModel):
    titulo: str = Field(min_length=3, max_length=120)
    descripcion: str = Field(default="", max_length=300)
    objetivo_monto: float = Field(gt=0, le=10_000_000)
    moneda: Literal["PEN", "USD"] = "PEN"
    activa: bool = True


class MetodoCobroIn(BaseModel):
    """Método de cobro de una organización (banco o Yape)."""
    tipo: Literal["banco", "yape"]
    titular: str = Field(min_length=3, max_length=120)
    banco: str | None = Field(default=None, max_length=60)
    tipo_cuenta: Literal["ahorros", "corriente"] | None = None
    numero_cuenta: str | None = Field(default=None, pattern=r"^[0-9-]{8,20}$")
    cci: str | None = Field(default=None, pattern=r"^\d{20}$")
    yape_numero: str | None = Field(default=None, pattern=r"^9\d{8}$")
    observaciones: str | None = Field(default=None, max_length=300)
    principal: bool = False

    @model_validator(mode="after")
    def _coherencia_tipo(self):
        if self.tipo == "banco" and not (self.banco and self.numero_cuenta):
            raise ValueError("banco y numero_cuenta son obligatorios para tipo banco")
        if self.tipo == "yape" and not self.yape_numero:
            raise ValueError("yape_numero es obligatorio para tipo yape")
        return self


class RetiroAccionIn(BaseModel):
    """Acción administrativa sobre un retiro."""
    accion: Literal["aprobar", "observar", "rechazar", "completar"]
    nota: str = Field(default="", max_length=500)


class ModeracionIn(BaseModel):
    """Acción de moderación del admin sobre un usuario u organización."""
    tipo: Literal["usuario", "organizacion"]
    id: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    accion: Literal["suspender", "banear", "reactivar"]
    motivo: str = Field(min_length=5, max_length=500)


class AvatarIn(BaseModel):
    """Imagen de perfil en base64 (el frontend la comprime a ~256px)."""
    imagen_base64: str = Field(min_length=10, max_length=2_800_000)  # ~2 MB decodificados
    mime: Literal["image/png", "image/jpeg", "image/webp"]


class PerfilUpdateIn(BaseModel):
    """Único campo editable del perfil de usuario (el email es la
    identidad de login y el rol lo gobierna el backend)."""
    nombre: str = Field(min_length=1, max_length=120)


class DonarIn(BaseModel):
    id_organizacion: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    monto: float = Field(gt=0, le=100000)
    moneda: Literal["PEN", "USD"] = "PEN"
    metodo_pago: Literal["tarjeta", "yape"] = "tarjeta"
    # Anónima = anónima para el público y la organización; el sistema
    # conserva id_donante para trazabilidad interna.
    es_anonima: bool = False
    # Datos de la tarjeta DEMO (solo metodo_pago=tarjeta). NUNCA se
    # guardan ni se logean.
    card_number: str | None = None
    card_exp: str | None = None
    card_cvv: str | None = None

    @model_validator(mode="after")
    def _valida_metodo(self):
        if self.metodo_pago == "tarjeta":
            pan = re.sub(r"\D", "", self.card_number or "")
            if len(pan) != 16:
                raise ValueError("card_number debe tener 16 dígitos")
            self.card_number = pan
            if not re.fullmatch(r"\d{2}/\d{2}", self.card_exp or ""):
                raise ValueError("card_exp formato MM/YY")
            if not re.fullmatch(r"\d{3}", self.card_cvv or ""):
                raise ValueError("card_cvv 3 dígitos")
        return self
