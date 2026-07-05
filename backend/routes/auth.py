"""
Endpoints de autenticación.

Decisiones:
  * Argon2id para password hashing (más resistente que bcrypt a GPU).
  * Mensaje genérico en login fallido (no decir si fue email o password
    para no facilitar user-enumeration).
  * Rate limit estricto en login: 5/min y 30/hora por IP.
  * Registro de cada intento en `intentos_login` (auditoría).
"""
from flask import Blueprint, request, jsonify, current_app, g
from pydantic import ValidationError

from services.security        import (hash_password, verify_password, issue_jwt,
                                      require_auth, require_cuenta_activa)
from services.supabase_client import client_service
from services.storage         import subir_avatar, AvatarInvalido
from validators.schemas       import RegisterIn, LoginIn, PerfilUpdateIn, AvatarIn

bp_auth = Blueprint("auth", __name__)


def _cookie_attrs():
    """Atributos de la cookie de sesión según entorno (ver login)."""
    is_prod = not current_app.config.get("DEBUG")
    return {"httponly": True, "secure": is_prod,
            "samesite": "None" if is_prod else "Lax"}


@bp_auth.post("/register")
def register():
    limiter = current_app.extensions["limiter"]
    limiter.limit("3/minute;10/hour")(lambda: None)()
    try:
        data = RegisterIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400

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
             .select("*")
             .eq("email", data.email)
             .limit(1)
             .execute())
    ok = bool(row.data) and verify_password(data.password, row.data[0]["password_hash"])

    # Auditoría (no logear la password obviamente). Si la auditoría
    # falla no debe tumbar el login: registrar y continuar.
    try:
        sb.table("intentos_login").insert({
            "email": data.email, "ip": request.remote_addr, "exito": ok,
        }).execute()
    except Exception:
        current_app.logger.exception("no se pudo registrar intento_login")

    if not ok:
        return jsonify(error="invalid_credentials"), 401

    u = row.data[0]
    # Moderación: un baneado no inicia sesión (aunque su password sea
    # correcta). Un suspendido sí entra: puede ver su historial, pero
    # las escrituras críticas las bloquea require_cuenta_activa.
    if (u.get("estado") or "activo") == "baneado":
        return jsonify(error="cuenta_bloqueada",
                       detail="Tu cuenta fue bloqueada. Contacta al administrador."), 403

    resp = jsonify(ok=True, rol=u["rol"])
    # En prod el frontend y el backend viven en dominios distintos
    # (*.onrender.com está en la Public Suffix List => cross-site), así
    # que la cookie necesita SameSite=None; Secure. En dev (proxy de
    # Vite, mismo origen) Lax es suficiente y funciona sin HTTPS.
    resp.set_cookie("nm_token", issue_jwt(u["id"], u["rol"]),
                    max_age=7200, **_cookie_attrs())
    return resp


@bp_auth.post("/logout")
def logout():
    """Invalida la sesión borrando la cookie HttpOnly (el frontend no
    puede hacerlo por JS, precisamente porque es HttpOnly)."""
    resp = jsonify(ok=True)
    resp.set_cookie("nm_token", "", max_age=0, expires=0, **_cookie_attrs())
    return resp


@bp_auth.get("/me")
@require_auth
def me():
    sb = client_service()
    row = (sb.table("usuarios").select("*")
             .eq("id", g.user["sub"]).limit(1).execute())
    if not row.data:
        return jsonify(error="not_found"), 404
    u = row.data[0]
    u.pop("password_hash", None)      # jamás sale del backend
    u.setdefault("avatar_url", None)  # compat pre-migración
    return jsonify(data=u)


@bp_auth.post("/mi-avatar")
@require_auth
@require_cuenta_activa
def mi_avatar():
    """Foto de perfil del usuario. La imagen viaja en base64 (el
    frontend la comprime a ~256px); el backend valida y sube a Storage."""
    try:
        data = AvatarIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Imagen inválida"), 400
    sb = client_service()
    try:
        url = subir_avatar(sb, "usuarios", g.user["sub"],
                           data.imagen_base64, data.mime)
    except AvatarInvalido as e:
        return jsonify(error="validation", detail=str(e)), 400
    sb.table("usuarios").update({"avatar_url": url}) \
      .eq("id", g.user["sub"]).execute()
    return jsonify(ok=True, avatar_url=url)


@bp_auth.put("/mi-perfil")
@require_auth
@require_cuenta_activa
def mi_perfil():
    try:
        data = PerfilUpdateIn(**(request.get_json(silent=True) or {}))
    except ValidationError:
        return jsonify(error="validation", detail="Datos inválidos"), 400
    sb = client_service()
    res = (sb.table("usuarios")
             .update({"nombre": data.nombre})
             .eq("id", g.user["sub"]).execute())
    if not res.data:
        return jsonify(error="not_found"), 404
    u = res.data[0]
    return jsonify(ok=True, data={"nombre": u["nombre"]})
