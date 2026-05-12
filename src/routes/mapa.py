from flask import Blueprint, jsonify
from services.supabase_client import client_anon

bp_mapa = Blueprint("mapa", __name__)

@bp_mapa.get("/mapa")
def get_mapa():
    sb   = client_anon()
    data = sb.table("mapa_riesgo").select("*").execute()
    return jsonify(data.data), 200