"""
MAPA DE LA API:

/api/mapa — devuelve el JSON del mapa de riesgo + organizaciones por
distrito. Lectura pública (los datos son agregados oficiales).

Optimización: si el frontend solo necesita render, agrupamos las
organizaciones por ubigeo en memoria. Esto evita N+1 queries.
"""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from flask import Blueprint, jsonify

from services.supabase_client import client_anon
from services.finanzas import ESTADOS_INGRESO

bp_mapa = Blueprint("mapa", __name__)


def _ubigeo6(v) -> str:
    """Normaliza ubigeo a string de 6 dígitos.

    Defensa contra datos importados como número (10101 -> '010101'):
    si la columna llegó a guardarse como bigint, el zero-padding se
    pierde y el join con organizaciones (char(6)) falla silenciosamente.
    """
    if v is None:
        return ""
    return str(v).strip().zfill(6)


@bp_mapa.get("/mapa")
def mapa():
    # Lectura pública -> anon key con RLS activo. La service key no se
    # usa aquí: este endpoint no necesita saltarse ninguna política.
    sb = client_anon()
    base = sb.table("mapa_riesgo").select("*").execute().data or []
    campos_publicos = ("id", "nombre", "ubigeo", "nivel_necesidad",
                       "descripcion", "tipo", "avatar_url")
    # select("*") + proyección: filtra moderación (estado) sin exponer
    # contacto/RUC y sin romper con BD pre-migración.
    orgs = [
        {k: o.get(k) for k in campos_publicos}
        for o in (sb.table("organizaciones").select("*")
                    .eq("activa", True).execute().data or [])
        if (o.get("estado") or "activo") == "activo"
    ]

    # Oferta social institucional (ENDES): comedores/ollas por distrito.
    # Tabla opcional: si aún no se cargó, el mapa sigue funcionando.
    oferta_by_ub = {}
    try:
        oferta = (sb.table("oferta_social")
                    .select("ubigeo,localidad,tipo,hogares_usan_comedor,"
                            "uso_comedor_pct,fuente")
                    .execute().data or [])
        oferta_by_ub = {_ubigeo6(o["ubigeo"]): o for o in oferta}
    except Exception:
        pass

    by_ub = defaultdict(list)
    for o in orgs:
        by_ub[_ubigeo6(o.get("ubigeo"))].append(o)

    for d in base:
        d["ubigeo"] = _ubigeo6(d.get("ubigeo"))
        d["organizaciones"] = by_ub.get(d["ubigeo"], [])
        d["oferta_social"] = oferta_by_ub.get(d["ubigeo"])
    return jsonify(data=base)


@bp_mapa.get("/stats")
def stats():
    """Resumen global público para el strip del dashboard."""
    sb = client_anon()
    resumen = {
        "total_donado": {}, "donaciones": 0, "donaciones_semana": 0,
        "organizaciones_activas": 0, "departamentos_con_orgs": 0,
        "distritos_con_oferta_social": 0,
    }
    try:
        orgs = (sb.table("organizaciones").select("ubigeo")
                  .eq("activa", True).execute().data or [])
        resumen["organizaciones_activas"] = len(orgs)
        resumen["departamentos_con_orgs"] = len(
            {_ubigeo6(o["ubigeo"])[:2] for o in orgs})
    except Exception:
        pass
    try:
        resumen["distritos_con_oferta_social"] = len(
            sb.table("oferta_social").select("id").execute().data or [])
    except Exception:
        pass
    # Donaciones: los montos agregados son públicos (transparencia),
    # pero la tabla no es legible con anon key -> lo agrega el backend.
    from services.supabase_client import client_service
    try:
        dons = (client_service().table("donaciones")
                .select("monto,moneda,estado,fecha").execute().data or [])
        hace_7d = datetime.now(timezone.utc) - timedelta(days=7)
        for d in dons:
            if d["estado"] not in ESTADOS_INGRESO:
                continue
            resumen["donaciones"] += 1
            m = d["moneda"]
            resumen["total_donado"][m] = round(
                resumen["total_donado"].get(m, 0) + float(d["monto"]), 2)
            try:
                if datetime.fromisoformat(d["fecha"]) >= hace_7d:
                    resumen["donaciones_semana"] += 1
            except (ValueError, TypeError):
                pass
    except Exception:
        pass
    return jsonify(data=resumen)
