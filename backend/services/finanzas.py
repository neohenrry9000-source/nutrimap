"""
Finanzas de una organización, por moneda:

  recaudado    = donaciones en estado de ingreso (completada/confirmada)
  retirado     = retiros completados
  comprometido = retiros en curso (pendiente/aprobado/observado)
  disponible   = recaudado - retirado - comprometido

La misma regla vive como trigger en BD (check_retiro_disponible), así
que este cálculo y el de Postgres nunca divergen en qué estados cuentan.
"""
from flask import current_app

ESTADOS_INGRESO = ("completada", "confirmada")
ESTADOS_RETIRO_EN_CURSO = ("pendiente", "aprobado", "observado")


def calcular_finanzas(sb, org_id) -> dict:
    dons = (sb.table("donaciones").select("monto,moneda,estado")
              .eq("id_organizacion", org_id).execute().data or [])
    try:
        rets = (sb.table("retiros").select("monto,moneda,estado")
                  .eq("id_organizacion", org_id).execute().data or [])
    except Exception:
        current_app.logger.warning("tabla retiros no disponible")
        rets = []

    por_moneda = {}

    def slot(m):
        return por_moneda.setdefault(m, {
            "recaudado": 0.0, "retirado": 0.0,
            "comprometido": 0.0, "disponible": 0.0,
        })

    for d in dons:
        if d["estado"] in ESTADOS_INGRESO:
            slot(d["moneda"])["recaudado"] += float(d["monto"])
    for r in rets:
        if r["estado"] == "completado":
            slot(r["moneda"])["retirado"] += float(r["monto"])
        elif r["estado"] in ESTADOS_RETIRO_EN_CURSO:
            slot(r["moneda"])["comprometido"] += float(r["monto"])

    for v in por_moneda.values():
        for k in ("recaudado", "retirado", "comprometido"):
            v[k] = round(v[k], 2)
        v["disponible"] = round(v["recaudado"] - v["retirado"] - v["comprometido"], 2)
    return por_moneda
