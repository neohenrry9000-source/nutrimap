"""
/api/organizaciones        GET  : lista pública (solo activas)
/api/organizaciones        POST : organización autenticada crea la suya
/api/mi-organizacion       GET  : la org del usuario actual
/api/mi-organizacion       PUT  : actualiza nivel_necesidad / descripcion
"""
import re
from flask import Blueprint, request, jsonify, g
from pydantic import ValidationError

from services.security        import require_auth, require_role
from services.supabase_client import client_service
from validators.schemas       import OrgIn

bp_org = Blueprint("org", __name__)


@bp_org.get("/organizaciones")
def listar():
    sb = client_service()
    q = sb.table("organizaciones").select(
        "id,nombre,ubigeo,lat,lng,nivel_necesidad,descripcion,tipo,activa"
    ).eq("activa", True)

    ub = request.args.get("ubigeo", "")
    if ub:
        if not re.fullmatch(r"\d{6}", ub):
            return jsonify(error="ubigeo_invalido"), 400
        q = q.eq("ubigeo", ub)

    nec = request.args.get("nivel_min")
    if nec:
        try:
            q = q.gte("nivel_necesidad", int(nec))
        except ValueError:
            return jsonify(error="nivel_invalido"), 400

    res = q.limit(500).execute()
    return jsonify(data=res.data)


@bp_org.post("/organizaciones")
@require_role("organizacion", "admin")
def crear():
    try:
        data = OrgIn(**(request.get_json(silent=True) or {}))
    except ValidationError as e:
        return jsonify(error="validation", detail=e.errors()), 400
    sb = client_service()
    ins = sb.table("organizaciones").insert({
        **data.model_dump(),
        "user_id": g.user["sub"],
    }).execute()
    return jsonify(data=ins.data[0]), 201


@bp_org.get("/mi-organizacion")
@require_role("organizacion", "admin")
def mi_get():
    sb = client_service()
    res = (sb.table("organizaciones").select("*")
             .eq("user_id", g.user["sub"]).limit(1).execute())
    return jsonify(data=(res.data[0] if res.data else None))


@bp_org.put("/mi-organizacion")
@require_role("organizacion", "admin")
def mi_put():
    body = request.get_json(silent=True) or {}
    # solo permitimos cambiar estos tres campos por seguridad
    permitido = {k: v for k, v in body.items()
                 if k in ("nivel_necesidad", "descripcion", "activa")}
    if "nivel_necesidad" in permitido:
        try:
            n = int(permitido["nivel_necesidad"])
        except (TypeError, ValueError):
            return jsonify(error="validation"), 400
        if not 1 <= n <= 5:
            return jsonify(error="validation"), 400
        permitido["nivel_necesidad"] = n

    sb = client_service()
    res = (sb.table("organizaciones").update(permitido)
             .eq("user_id", g.user["sub"]).execute())
    return jsonify(data=res.data)
