"""
NutriMap — Base masiva de oferta social (ENDES 2024)
====================================================
Cruza PS_COMEDOR_2024.csv (hogares que usan comedores populares) con
RECH0_2024.csv (ubicación de cada hogar) y agrega por distrito:

  - hogares encuestados en el distrito
  - hogares que usan comedor (PS5 en 1..5 = uso real)
  - % de uso, localidad referencial (NOMCCPP más frecuente)
  - coordenadas representativas (mediana del conglomerado)

Salida: data/out/oferta_social.csv (importable en Supabase) y, con
--load, upsert directo a la tabla public.oferta_social usando la
service key (variables SUPABASE_URL / SUPABASE_SERVICE_KEY, que puede
tomar de backend/.env).

NO inventa registros: solo distritos con al menos un hogar usuario de
comedor en la muestra ENDES.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT_DIR = ROOT / "data" / "out"

# Los CSV pueden estar en /data o en la raíz del repo (con o sin " (1)")
CANDIDATOS = {
    "rech0": ["RECH0_2024.csv", "RECH0_2024 (1).csv", "RECH0_2024-1.csv"],
    "ps":    ["PS_COMEDOR_2024.csv"],
}

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


def _buscar(nombres: list[str]) -> Path:
    for base in (ROOT / "data", ROOT):
        for n in nombres:
            p = base / n
            if p.exists():
                return p
    raise FileNotFoundError(f"No encontré ninguno de {nombres} en {ROOT} ni {ROOT/'data'}")


def construir() -> pd.DataFrame:
    rech0 = pd.read_csv(_buscar(CANDIDATOS["rech0"]), encoding="utf-8-sig",
                        dtype={"HHID": "Int64", "UBIGEO": str})
    ps = pd.read_csv(_buscar(CANDIDATOS["ps"]), encoding="utf-8-sig",
                     dtype={"HHID": "Int64"})

    hogares = rech0[["HHID", "UBIGEO", "NOMCCPP", "LATITUDY", "LONGITUDX"]].copy()
    hogares["ubigeo"] = hogares["UBIGEO"].astype(str).str.strip().str.zfill(6)
    hogares = hogares[hogares["ubigeo"].str.fullmatch(r"\d{6}")]

    # PS5 1..5 = usa el comedor con alguna frecuencia; >5/9 = no usa / NS
    ps = ps[["HHID", "PS5"]].copy()
    ps["usa"] = pd.to_numeric(ps["PS5"], errors="coerce").between(1, 5).astype(int)
    usa_por_hogar = ps.groupby("HHID", as_index=False)["usa"].max()

    m = hogares.merge(usa_por_hogar, on="HHID", how="left")
    m["usa"] = m["usa"].fillna(0).astype(int)

    def localidad_moda(s: pd.Series) -> str:
        s = s.dropna().astype(str).str.strip().str.title()
        return s.mode().iloc[0] if len(s) else ""

    agg = (m.groupby("ubigeo")
             .agg(hogares_encuestados=("HHID", "size"),
                  hogares_usan_comedor=("usa", "sum"),
                  localidad=("NOMCCPP", localidad_moda),
                  lat=("LATITUDY", "median"),
                  lng=("LONGITUDX", "median"))
             .reset_index())

    # Solo distritos con oferta social observada (>=1 hogar usuario).
    agg = agg[agg["hogares_usan_comedor"] > 0].copy()
    agg["uso_comedor_pct"] = (agg["hogares_usan_comedor"]
                              / agg["hogares_encuestados"] * 100).round(1)
    agg["departamento"] = agg["ubigeo"].str[:2].map(DEPARTAMENTOS).fillna("Desconocido")
    agg["provincia_code"] = agg["ubigeo"].str[:4]
    agg["tipo"] = "comedor_popular"
    agg["fuente"] = "ENDES 2024 / INEI (PS_COMEDOR)"
    agg["periodo"] = "2024"

    cols = ["ubigeo", "departamento", "provincia_code", "localidad", "tipo",
            "hogares_encuestados", "hogares_usan_comedor", "uso_comedor_pct",
            "lat", "lng", "fuente", "periodo"]
    return agg[cols].sort_values("ubigeo").reset_index(drop=True)


def cargar_a_supabase(df: pd.DataFrame) -> None:
    # Toma credenciales del entorno; si faltan, intenta backend/.env
    if not os.environ.get("SUPABASE_URL"):
        env = ROOT / "backend" / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.partition("=")
                    os.environ.setdefault(k.strip(), v.strip())

    from supabase import create_client
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    rows = df.where(pd.notnull(df), None).to_dict(orient="records")
    for i in range(0, len(rows), 200):
        sb.table("oferta_social").upsert(
            rows[i:i + 200], on_conflict="ubigeo,tipo").execute()
    print(f"OK -> {len(rows)} registros upsertados en public.oferta_social")


def main() -> int:
    df = construir()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / "oferta_social.csv"
    df.to_csv(out, index=False)
    print(f"OK -> {out}  ({len(df)} distritos con oferta social)")
    print(f"Hogares usuarios de comedor: {int(df['hogares_usan_comedor'].sum())}")
    print(df.groupby("departamento").size().sort_values(ascending=False)
            .head(8).to_string())

    if "--load" in sys.argv:
        cargar_a_supabase(df)
    return 0


if __name__ == "__main__":
    sys.exit(main())
