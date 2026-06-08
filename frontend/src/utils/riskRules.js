export const RISK_SCORE = {
  SIN_DATOS: 0,
  BAJO: 1,
  MEDIO: 2,
  ALTO: 3,
  MUY_ALTO: 4,
};

export function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function firstDefined(...values) {
  return values.find((v) => v !== null && v !== undefined && v !== "");
}

export function getTotalNinos(row = {}) {
  return toNumber(firstDefined(
    row.total_ninos,
    row.ninos_evaluados,
    row.niños_evaluados,
    row.muestra,
    row.total_muestra,
    row.n,
    row.total
  ), 0);
}

export function getCasosAnemia(row = {}) {
  return toNumber(firstDefined(
    row.casos_anemia,
    row.casos_detectados,
    row.anemia_casos,
    row.casos,
    row.n_anemia
  ), 0);
}

export function getAnemiaPct(row = {}) {
  const direct = firstDefined(
    row.porcentaje_anemia,
    row.anemia_pct,
    row.anemia_promedio,
    row.pct_anemia,
    row.anemia
  );
  if (direct !== undefined) return toNumber(direct, null);

  const total = getTotalNinos(row);
  const casos = getCasosAnemia(row);
  return total > 0 ? (casos / total) * 100 : null;
}

export function getCoberturaComedor(row = {}) {
  const value = firstDefined(
    row.tiene_cobertura_comedor,
    row.con_comedor,
    row.comedor,
    row.cobertura_comedor
  );
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    return ["true", "1", "si", "sí", "yes", "con comedor"].includes(v);
  }
  return false;
}

export function riskLabel(nivel) {
  return String(nivel || "SIN_DATOS").replace("_", " ");
}

export function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Sin datos";
  return `${Number(value).toFixed(1)}%`;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("es-PE").format(toNumber(value, 0));
}

export function riskFromAnemia(porcentajeAnemia) {
  // Regla académica central: si hay porcentaje de anemia, se clasifica por porcentaje.
  // No exigimos muestra > 0 porque el API puede enviar porcentaje_anemia aunque la tarjeta tenga otro nombre de campo para la muestra.
  if (porcentajeAnemia === null || porcentajeAnemia === undefined || Number.isNaN(Number(porcentajeAnemia))) {
    return "SIN_DATOS";
  }

  const anemia = Number(porcentajeAnemia);
  if (anemia < 25) return "BAJO";
  if (anemia < 35) return "MEDIO";
  if (anemia < 45) return "ALTO";
  return "MUY_ALTO";
}

export function riskFromDepartmentIndicators(porcentajeAnemia, coberturaComedorPct, distritos) {
  if (!distritos || porcentajeAnemia === null || porcentajeAnemia === undefined || Number.isNaN(Number(porcentajeAnemia))) {
    return "SIN_DATOS";
  }

  const anemia = Number(porcentajeAnemia);
  const cobertura = coberturaComedorPct === null || coberturaComedorPct === undefined
    ? null
    : Number(coberturaComedorPct);

  let score = 0;
  if (anemia < 25) score = 1;
  else if (anemia < 35) score = 2;
  else if (anemia < 45) score = 3;
  else score = 4;

  // Si casi no hay comedores, sube la prioridad levemente, pero no convierte todo automáticamente a rojo.
  if (cobertura !== null && cobertura < 15) score += 0.35;

  if (score < 1.75) return "BAJO";
  if (score < 2.75) return "MEDIO";
  if (score < 3.75) return "ALTO";
  return "MUY_ALTO";
}

export function isNumericDistrictName(value, ubigeo) {
  const v = String(value || "").trim();
  return !v || v === String(ubigeo || "").padStart(6, "0") || /^\d{6}$/.test(v);
}
