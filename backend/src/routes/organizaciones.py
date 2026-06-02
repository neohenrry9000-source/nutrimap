from flask import Blueprint, request, jsonify
from services.supabase_client import client_anon
from services.security import require_auth

bp_org = Blueprint("org", __name__)



# LISTAR ORGANIZACIONES
@bp_org.get("/organizaciones")
def list_orgs():

    tipo = request.args.get("tipo")

    sb = client_anon()

    query = (
        sb.table("organizaciones")
        .select("*")
        .eq("activa", True)
    )

    if tipo:
        query = query.eq("tipo", tipo)

    data = query.execute()

    return jsonify(data.data), 200


# CREAR ORGANIZACION

@bp_org.post("/organizaciones")
@require_auth
def create_org():

    body = request.get_json() or {}

    sb = client_anon()

    sb.table("organizaciones").insert({
        "user_id": body.get("user_id"),
        "nombre": body.get("nombre"),
        "ubigeo": body.get("ubigeo"),
        "lat": body.get("lat"),
        "lng": body.get("lng"),
        "nivel_necesidad": body.get("nivel_necesidad", 3),
        "descripcion": body.get("descripcion"),
        "tipo": body.get("tipo", "olla_comun"),
        "activa": True
    }).execute()

    return jsonify(ok=True), 201

# ACTUALIZAR ORGANIZACION

@bp_org.put("/organizaciones/<org_id>")
@require_auth
def update_org(org_id):

    body = request.get_json() or {}

    sb = client_anon()

    sb.table("organizaciones").update({
        "nombre": body.get("nombre"),
        "ubigeo": body.get("ubigeo"),
        "lat": body.get("lat"),
        "lng": body.get("lng"),
        "nivel_necesidad": body.get("nivel_necesidad"),
        "descripcion": body.get("descripcion"),
        "tipo": body.get("tipo")
    }).eq("id", org_id).execute()

    return jsonify(ok=True), 200


# ELIMINAR ORGANIZACION

@bp_org.delete("/organizaciones/<org_id>")
@require_auth
def delete_org(org_id):

    sb = client_anon()

    sb.table("organizaciones").update({
        "activa": False
    }).eq("id", org_id).execute()

    return jsonify(ok=True), 200