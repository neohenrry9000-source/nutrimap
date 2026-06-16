"""
Validación con Pydantic v2. Convertimos cualquier ValidationError en un
400 limpio en cada route. Esto previene:
  * inyección por tipos inesperados
  * payloads gigantes
  * datos mal formados que rompan SQL/ORM
"""
import re
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    rol: Literal["donador", "organizacion"] = "donador"
    nombre: str = Field(default="", max_length=120)


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


class DonarIn(BaseModel):
    id_organizacion: str = Field(pattern=r"^[0-9a-fA-F-]{36}$")
    monto: float = Field(gt=0, le=100000)
    moneda: Literal["PEN", "USD"] = "PEN"
    # Datos de la tarjeta DEMO. NUNCA se guardan ni se logean.
    card_number: str
    card_exp: str
    card_cvv: str

    @field_validator("card_number")
    @classmethod
    def _pan(cls, v: str) -> str:
        v = re.sub(r"\D", "", v)
        if len(v) != 16:
            raise ValueError("card_number debe tener 16 dígitos")
        return v

    @field_validator("card_exp")
    @classmethod
    def _exp(cls, v: str) -> str:
        if not re.fullmatch(r"\d{2}/\d{2}", v):
            raise ValueError("card_exp formato MM/YY")
        return v

    @field_validator("card_cvv")
    @classmethod
    def _cvv(cls, v: str) -> str:
        if not re.fullmatch(r"\d{3}", v):
            raise ValueError("card_cvv 3 dígitos")
        return v
