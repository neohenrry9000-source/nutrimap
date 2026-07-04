"""Utilidades compartidas para listar/resumir donaciones."""

from services.finanzas import ESTADOS_INGRESO


def resumen_donaciones(rows):
    """Totales por moneda (estados de ingreso) + conteos por estado."""
    totales, estados = {}, {}
    for r in rows:
        estados[r["estado"]] = estados.get(r["estado"], 0) + 1
        if r["estado"] in ESTADOS_INGRESO:
            m = r["moneda"]
            totales[m] = round(totales.get(m, 0) + float(r["monto"]), 2)
    return {"cantidad": len(rows), "totales_completadas": totales,
            "por_estado": estados}
