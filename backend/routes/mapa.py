"""
/api/mapa — devuelve el JSON del mapa de riesgo + organizaciones por
distrito. Lectura pública (los datos son agregados oficiales).

Optimización: si el frontend solo necesita render, agrupamos las
organizaciones por ubigeo en memoria. Esto evita N+1 queries.
"""
from collections import defaultdict
from flask import Blueprint, jsonify

from services.supabase_client import client_service

bp_mapa = Blueprint("mapa", __name__)


@bp_mapa.get("/mapa")
def mapa():
    sb = client_service()
    base = sb.table("mapa_riesgo").select("*").execute().data or []
    orgs = (sb.table("organizaciones")
              .select("id,nombre,ubigeo,nivel_necesidad,descripcion,tipo")
              .eq("activa", True).execute().data or [])

    by_ub = defaultdict(list)
    for o in orgs:
        by_ub[o["ubigeo"]].append(o)

    for d in base:
        d["organizaciones"] = by_ub.get(d["ubigeo"], [])
    return jsonify(data=base)
