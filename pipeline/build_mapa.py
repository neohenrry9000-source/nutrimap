"""
NutriMap — Pipeline ENDES 2024
==============================
Cruza tres datasets oficiales del INEI (ENDES):
  - RECH0_2024.csv    : hogares (UBIGEO, depto, lat/lng)
  - REC44_2024.csv    : niños 0–59 meses con medición de hemoglobina
  - PS_COMEDOR_2024.csv : acceso a programas / comedores populares

Salida:
  - data_mapa_limpia.json (entrada del frontend)
  - data_mapa_limpia.csv  (auditable para el informe)

Reglas (ver enunciado, sección 2):
  - NO inventar columnas. Si un campo es ambiguo se marca con # AJUSTAR.
  - NO inventar datos. Distritos con muestra < MIN_NINOS se etiquetan
    explícitamente como 'sin datos suficientes'.

Autor: alumno NutriMap — curso Arq. Apps Seguras
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Tuple

import pandas as pd

# ------------------------------------------------------------------
# CONFIGURACIÓN
# ------------------------------------------------------------------
HERE = Path(__file__).resolve().parent
DATA_DIR = HERE.parent / "data"          # coloca aquí los CSV ENDES
OUT_DIR  = HERE.parent / "data" / "out"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# Tamaño mínimo de muestra para que el % de anemia sea representativo.
# Es deliberadamente pequeño para un proyecto académico; en publicación
# real INEI exige n >= 30 por dominio (ENDES). Mantener configurable.
MIN_NINOS = 5

# Umbrales OMS para anemia como problema de salud pública (a nivel
# poblacional). Son rangos estándar y citables en el informe.
#   <  5 %   : sin problema relevante           -> verde (BAJO)
#   5–19.9 % : problema leve                     -> amarillo (MEDIO)
#   20–39.9% : problema moderado                 -> naranja  (ALTO)
#   >= 40 %  : problema severo de salud pública  -> rojo     (MUY_ALTO)
NIVELES = [
    # (limite_superior_exclusivo, etiqueta, color_hex)
    (5.0,   "BAJO",     "#2ecc71"),
    (20.0,  "MEDIO",    "#f1c40f"),
    (40.0,  "ALTO",     "#e67e22"),
    (101.0, "MUY_ALTO", "#c0392b"),
]

# Códigos de departamento → nombre (estándar INEI, primeros 2 dígitos
# del UBIGEO). Si quieres provincia/distrito por nombre debes cruzar
# con el padrón de UBIGEOS del INEI (ubigeos.csv); ver TODO al final.
DEPARTAMENTOS = {
    "01": "Amazonas",  "02": "Áncash",     "03": "Apurímac",
    "04": "Arequipa",  "05": "Ayacucho",   "06": "Cajamarca",
    "07": "Callao",    "08": "Cusco",      "09": "Huancavelica",
    "10": "Huánuco",   "11": "Ica",        "12": "Junín",
    "13": "La Libertad","14": "Lambayeque","15": "Lima",
    "16": "Loreto",    "17": "Madre de Dios","18": "Moquegua",
    "19": "Pasco",     "20": "Piura",      "21": "Puno",
    "22": "San Martín","23": "Tacna",      "24": "Tumbes",
    "25": "Ucayali",
}


# ------------------------------------------------------------------
# UTILIDADES
# ------------------------------------------------------------------
def _ubigeo6(x) -> str:
    """UBIGEO viene como entero sin zero-padding (10101 -> '010101')."""
    try:
        return str(int(x)).zfill(6)
    except (TypeError, ValueError):
        return ""


def _hhid_from_caseid(caseid: str) -> int | None:
    """
    En ENDES, CASEID = HHID (numérico) + línea de la madre, separados
    por espacios. Ejemplo: '      325503101  2'  ->  HHID = 325503101.
    Extraemos la primera secuencia numérica.
    """
    if not isinstance(caseid, str):
        return None
    tok = caseid.strip().split()
    if not tok:
        return None
    try:
        return int(tok[0])
    except ValueError:
        return None


def clasificar(porc: float) -> Tuple[str, str]:
    """Devuelve (nivel_riesgo, color_mapa) a partir del % de anemia."""
    for limite, etiqueta, color in NIVELES:
        if porc < limite:
            return etiqueta, color
    return "MUY_ALTO", "#c0392b"


# ------------------------------------------------------------------
# CARGA
# ------------------------------------------------------------------
def cargar() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Lee los tres CSV. Tolerante a BOM (utf-8-sig)."""
    rech0 = pd.read_csv(DATA_DIR / "RECH0_2024.csv", encoding="utf-8-sig",
                        dtype={"HHID": "Int64", "UBIGEO": "Int64"})
    rec44 = pd.read_csv(DATA_DIR / "REC44_2024.csv", encoding="utf-8-sig",
                        dtype={"CASEID": "string"})
    ps    = pd.read_csv(DATA_DIR / "PS_COMEDOR_2024.csv", encoding="utf-8-sig",
                        dtype={"HHID": "Int64"})
    return rech0, rec44, ps


# ------------------------------------------------------------------
# TRANSFORMACIÓN
# ------------------------------------------------------------------
def preparar_hogares(rech0: pd.DataFrame) -> pd.DataFrame:
    """Hogar -> UBIGEO + coordenadas del conglomerado."""
    df = rech0[["HHID", "UBIGEO", "LATITUDY", "LONGITUDX"]].copy()
    df["ubigeo"] = df["UBIGEO"].apply(_ubigeo6)
    df = df[df["ubigeo"].str.len() == 6]
    return df.rename(columns={"LATITUDY": "lat", "LONGITUDX": "lng"})


def preparar_ninos(rec44: pd.DataFrame) -> pd.DataFrame:
    """
    Niños 0–59 meses con HW57 válido (1..4).
       HW57 = 1 severa / 2 moderada / 3 leve  -> CON ANEMIA
       HW57 = 4 -> sin anemia
       HW57 = 9 o vacío -> excluir (no medido / perdido)
    """
    df = rec44[["CASEID", "HW1", "HW57"]].copy()
    df["HHID"] = df["CASEID"].apply(_hhid_from_caseid).astype("Int64")

    # HW1 (edad meses) y HW57 vienen con strings vacíos -> a numérico
    df["edad_meses"] = pd.to_numeric(df["HW1"], errors="coerce")
    df["hw57"]       = pd.to_numeric(df["HW57"], errors="coerce")

    df = df[df["hw57"].isin([1, 2, 3, 4])]                  # medidos
    df = df[df["edad_meses"].between(0, 59, inclusive="both")]
    df["con_anemia"] = df["hw57"].isin([1, 2, 3]).astype(int)
    return df[["HHID", "edad_meses", "hw57", "con_anemia"]]


def preparar_comedor(ps: pd.DataFrame) -> pd.DataFrame:
    """
    PS5 = frecuencia de uso del comedor; valores 1..5 indican uso real.
    Marcamos al hogar como 'usa_comedor' = 1 si reporta cualquier uso.
    AJUSTAR si tu cuestionario ENDES define otro código (consultar
    ficha técnica PS_COMEDOR del INEI antes de publicar).
    """
    df = ps[["HHID", "PS5"]].copy()
    df["ps5"] = pd.to_numeric(df["PS5"], errors="coerce")
    df["usa_comedor"] = df["ps5"].between(1, 5).astype(int)
    # Un hogar puede aparecer varias veces (por miembro) -> max por HHID
    return df.groupby("HHID", as_index=False)["usa_comedor"].max()


def construir_distrito(hogares, ninos, comedor) -> pd.DataFrame:
    """JOIN hogares-niños y hogares-comedor, luego agregar por UBIGEO."""
    # ninos -> agrega ubigeo via HHID
    ninos_ub = ninos.merge(hogares[["HHID", "ubigeo"]], on="HHID", how="inner")
    agg_anemia = (ninos_ub
                  .groupby("ubigeo")
                  .agg(total_ninos=("con_anemia", "size"),
                       casos_anemia=("con_anemia", "sum"))
                  .reset_index())

    # comedor -> proporción de hogares del distrito que usan comedor
    comedor_ub = (hogares.merge(comedor, on="HHID", how="left")
                  .assign(usa_comedor=lambda d: d["usa_comedor"].fillna(0))
                  .groupby("ubigeo")
                  .agg(hogares_total=("HHID", "size"),
                       hogares_comedor=("usa_comedor", "sum"))
                  .reset_index())

    # coordenadas representativas (mediana del conglomerado por distrito)
    coords = (hogares.groupby("ubigeo")
              .agg(lat=("lat", "median"), lng=("lng", "median"))
              .reset_index())

    df = agg_anemia.merge(comedor_ub, on="ubigeo", how="left") \
                   .merge(coords,     on="ubigeo", how="left")

    df["porcentaje_anemia"] = (df["casos_anemia"] / df["total_ninos"] * 100).round(1)
    df["tiene_cobertura_comedor"] = (df["hogares_comedor"] > 0).astype(bool)
    df["cobertura_comedor_pct"]   = (df["hogares_comedor"] / df["hogares_total"] * 100).round(1)
    return df


def enriquecer(df: pd.DataFrame) -> pd.DataFrame:
    """Añade nombre de departamento, nivel de riesgo y color del mapa."""
    df["departamento"] = df["ubigeo"].str[:2].map(DEPARTAMENTOS).fillna("Desconocido")
    df["provincia"] = df["ubigeo"].str[:4]    # solo código; nombre via padrón INEI
    df["distrito"]  = df["ubigeo"]            # idem

    # Clasificación final, con guardrail por muestra insuficiente.
    def _clasif(row):
        if row["total_ninos"] < MIN_NINOS:
            return pd.Series({"nivel_riesgo": "SIN_DATOS",
                              "color_mapa":  "#bdc3c7"})
        # Si hay anemia alta Y no hay cobertura de comedor, sube un nivel.
        porc = row["porcentaje_anemia"]
        nivel, color = clasificar(porc)
        if not row["tiene_cobertura_comedor"] and nivel == "ALTO":
            nivel, color = "MUY_ALTO", "#c0392b"
        return pd.Series({"nivel_riesgo": nivel, "color_mapa": color})

    df[["nivel_riesgo", "color_mapa"]] = df.apply(_clasif, axis=1)
    return df


# ------------------------------------------------------------------
# EXPORT
# ------------------------------------------------------------------
def exportar(df: pd.DataFrame) -> None:
    cols = [
        "ubigeo", "departamento", "provincia", "distrito",
        "total_ninos", "casos_anemia", "porcentaje_anemia",
        "tiene_cobertura_comedor", "cobertura_comedor_pct",
        "nivel_riesgo", "color_mapa", "lat", "lng",
    ]
    out = df[cols].copy()
    out.to_csv(OUT_DIR / "data_mapa_limpia.csv", index=False)
    out["organizaciones"] = [[] for _ in range(len(out))]   # se llena luego
    out.to_json(OUT_DIR / "data_mapa_limpia.json",
                orient="records", force_ascii=False, indent=2)
    print(f"OK -> {OUT_DIR/'data_mapa_limpia.json'}  ({len(out)} distritos)")
    # Resumen para el informe
    print("\nDistribución por nivel de riesgo:")
    print(out["nivel_riesgo"].value_counts().to_string())


def main() -> int:
    if not (DATA_DIR / "RECH0_2024.csv").exists():
        print(f"ERROR: coloca los CSV en {DATA_DIR}/", file=sys.stderr)
        return 1
    rech0, rec44, ps = cargar()
    hogares = preparar_hogares(rech0)
    ninos   = preparar_ninos(rec44)
    comedor = preparar_comedor(ps)
    distrito = construir_distrito(hogares, ninos, comedor)
    distrito = enriquecer(distrito)
    exportar(distrito)
    return 0


if __name__ == "__main__":
    sys.exit(main())

# TODO (no inventar): para provincia/distrito por NOMBRE descarga el
# padrón oficial de UBIGEOS del INEI o RENIEC y haz un left-join por
# los primeros 4 y 6 dígitos del ubigeo. Ej:
#   ubigeos = pd.read_csv("padron_ubigeos_inei.csv", dtype=str)
#   df.merge(ubigeos, on="ubigeo", how="left")
