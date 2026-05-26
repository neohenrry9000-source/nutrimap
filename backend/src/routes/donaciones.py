from flask import Blueprint, request, jsonify
from services.supabase_client import client_anon
from services.security        import require_auth

bp_don = Blueprint("don", __name__)

@bp_don.get("/donaciones")
@require_auth
def list_donaciones():
    sb   = client_anon()
    data = sb.table("donaciones").select("*").execute()
    return jsonify(data.data), 200

@bp_don.post("/donaciones")
@require_auth
def create_donacion():
    body = request.get_json() or {}
    sb   = client_anon()
    sb.table("donaciones").insert({
        "id_donante":      body.get("id_donante"),
        "id_organizacion": body.get("id_organizacion"),
        "monto":           body.get("monto"),
        "moneda":          body.get("moneda", "PEN"),
    }).execute()
    return jsonify(ok=True), 201