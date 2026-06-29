"""
Servicios transversales de seguridad:
  * Argon2id para password hashing (passlib)
  * Emisión / verificación de JWT (PyJWT)
  * Decoradores require_auth y require_role
"""
import functools
from datetime import datetime, timezone

import jwt
from flask import current_app, request, g, jsonify
from passlib.hash import argon2

# Argon2id con parámetros razonables para demo + servidores chicos.
# En producción aumenta time_cost y memory_cost según OWASP.
_HASHER = argon2.using(type="ID", rounds=3, memory_cost=65536, parallelism=2)


def hash_password(plain: str) -> str:
    return _HASHER.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _HASHER.verify(plain, hashed)
    except Exception:
        return False


def issue_jwt(user_id: str, rol: str) -> str:
    cfg = current_app.config
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "rol": rol,
        "iat": int(now.timestamp()),
        "exp": int((now + cfg["JWT_EXP"]).timestamp()),
    }
    return jwt.encode(payload, cfg["JWT_SECRET"], algorithm=cfg["JWT_ALG"])


def decode_jwt(token: str) -> dict | None:
    try:
        return jwt.decode(token,
                          current_app.config["JWT_SECRET"],
                          algorithms=[current_app.config["JWT_ALG"]])
    except jwt.PyJWTError:
        return None


def require_auth(fn):
    @functools.wraps(fn)
    def wrapper(*a, **kw):
        token = request.cookies.get("nm_token")
        if not token:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("Bearer "):
                token = auth[7:]
        if not token:
            return jsonify(error="unauthorized"), 401
        payload = decode_jwt(token)
        if not payload:
            return jsonify(error="unauthorized"), 401
        g.user = payload
        return fn(*a, **kw)
    return wrapper


def require_role(*roles):
    def deco(fn):
        @functools.wraps(fn)
        @require_auth
        def wrapper(*a, **kw):
            if g.user.get("rol") not in roles:
                return jsonify(error="forbidden"), 403
            return fn(*a, **kw)
        return wrapper
    return deco
