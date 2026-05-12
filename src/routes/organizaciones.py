from flask import Blueprint, request, jsonify
from services.supabase_client import client_anon
from services.security        import require_auth

bp_org = Blueprint("org", __name__)

@bp_org.get("/organizaciones")
def list_orgs():
    sb   = client_anon()
    data = sb.table("organizaciones").select("*").eq("activa", True).execute()
    return jsonify(data.data), 200

@bp_org.post("/organizaciones")
@require_auth
def create_org():
    body = request.get_json() or {}
    sb   = client_anon()
    sb.table("organizaciones").insert({
        "user_id":        body.get("user_id"),
        "nombre":         body.get("nombre"),
        "ubigeo":         body.get("ubigeo"),
        "lat":            body.get("lat"),
        "lng":            body.get("lng"),
        "nivel_necesidad": body.get("nivel_necesidad", 3),
        "tipo":           body.get("tipo", "olla_comun"),
    }).execute()
    return jsonify(ok=True), 201