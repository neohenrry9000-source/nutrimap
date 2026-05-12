from pydantic import BaseModel, EmailStr
from typing import Literal

class RegisterIn(BaseModel):
    email:    EmailStr
    password: str
    nombre:   str
    rol:      Literal["donador", "organizacion"] = "donador"

class LoginIn(BaseModel):
    email:    EmailStr
    password: str