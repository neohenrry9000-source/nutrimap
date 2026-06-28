"""
Endpoints de autenticación.

Decisiones:
  * Argon2id para password hashing (más resistente que bcrypt a GPU).
  * Mensaje genérico en login fallido (no decir si fue email o password
    para no facilitar user-enumeration).
  * Rate limit estricto en login: 5/min y 30/hora por IP.
  * Registro de cada intento en `intentos_login` (auditoría).
"""
from flask import Blueprint, request, jsonify, current_app
from pydantic import ValidationError

from services.security        import hash_password, verify_password, issue_jwt
from services.supabase_client import client_service
from validators.schemas       import RegisterIn, LoginIn

bp_auth = Blueprint("auth", __name__)


@bp_auth.post("/register")
def register():
    limiter = current_app.extensions["limiter"]
    limiter.limit("3/minute;10/hour")(lambda: None)()
    try:
        data = RegisterIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=e.errors()), 400

    sb = client_service()
    exists = sb.table("usuarios").select("id").eq("email", data.email).execute()
    if exists.data:
        return jsonify(error="email_taken"), 409

    sb.table("usuarios").insert({
        "email":         data.email,
        "password_hash": hash_password(data.password),
        "rol":           data.rol,
        "nombre":        data.nombre,
    }).execute()
    return jsonify(ok=True), 201


@bp_auth.post("/login")
def login():
    limiter = current_app.extensions["limiter"]
    # Aplicamos un límite explícito a esta vista
    limiter.limit("5/minute;30/hour")(lambda: None)()  # marca el hit

    try:
        data = LoginIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation"), 400

    sb = client_service()
    row = (sb.table("usuarios")
             .select("id,password_hash,rol")
             .eq("email", data.email)
             .limit(1)
             .execute())
    ok = bool(row.data) and verify_password(data.password, row.data[0]["password_hash"])

    # Auditoría (no logear la password obviamente)
    sb.table("intentos_login").insert({
        "email": data.email, "ip": request.remote_addr, "exito": ok,
    }).execute()

    if not ok:
        return jsonify(error="invalid_credentials"), 401

    u = row.data[0]
    return jsonify(token=issue_jwt(u["id"], u["rol"]), rol=u["rol"])
