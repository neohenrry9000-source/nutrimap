"""
Niveles de donador (gamificación).

Se calculan al vuelo desde las donaciones ingresadas en PEN (las USD se
convierten con un factor fijo demo). Solo se muestran al propio donador
en su panel: no tocan el feed público ni rompen el anonimato.
"""

USD_A_PEN_DEMO = 3.8

# (clave, nombre, umbral_total_pen, color_hex)
NIVELES = [
    ("semilla",  "Semilla",  0,    "#8a9a5b"),
    ("bronce",   "Bronce",   100,  "#cd7f32"),
    ("plata",    "Plata",    300,  "#9ea7b3"),
    ("oro",      "Oro",      800,  "#d4a017"),
    ("platino",  "Platino",  2000, "#79d0c3"),
    ("diamante", "Diamante", 5000, "#7aa7e8"),
]


def calcular_nivel(rows) -> dict:
    """`rows`: donaciones del donador (dicts con monto/moneda/estado)."""
    from services.finanzas import ESTADOS_INGRESO

    total = 0.0
    cantidad = 0
    for r in rows:
        if r["estado"] not in ESTADOS_INGRESO:
            continue
        cantidad += 1
        monto = float(r["monto"])
        total += monto * (USD_A_PEN_DEMO if r["moneda"] == "USD" else 1)

    actual = NIVELES[0]
    siguiente = None
    for i, n in enumerate(NIVELES):
        if total >= n[2]:
            actual = n
            siguiente = NIVELES[i + 1] if i + 1 < len(NIVELES) else None

    resultado = {
        "clave": actual[0],
        "nombre": actual[1],
        "color": actual[3],
        "total_pen": round(total, 2),
        "donaciones_ingresadas": cantidad,
        "siguiente": None,
    }
    if siguiente:
        falta = max(0.0, siguiente[2] - total)
        base = actual[2]
        rango = siguiente[2] - base
        resultado["siguiente"] = {
            "clave": siguiente[0],
            "nombre": siguiente[1],
            "umbral_pen": siguiente[2],
            "falta_pen": round(falta, 2),
            "progreso_pct": round(min(100.0, (total - base) / rango * 100), 1) if rango else 100.0,
        }
    return resultado
