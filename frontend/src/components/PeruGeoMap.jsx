import { useEffect, useMemo, useState } from "react";
import { GeoJSON, MapContainer, ZoomControl, useMap } from "react-leaflet";
import { colorFor } from "../utils/colors.js";
import {
  formatNumber,
  formatPercent,
  getAnemiaPct,
  getCasosAnemia,
  getCoberturaComedor,
  getTotalNinos,
  RISK_SCORE,
  riskFromAnemia,
  riskFromDepartmentIndicators,
  riskLabel,
} from "../utils/riskRules.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";
import "leaflet/dist/leaflet.css";

// Primero intenta cargar el GeoJSON local. Si no existe, usa el remoto.
const GEOJSON_URLS = [
  "/peru_departamental_simple.geojson",
  "https://raw.githubusercontent.com/juaneladio/peru-geojson/master/peru_departamental_simple.geojson",
];

const PERU_CENTER = [-9.19, -75.0152];
const PERU_BOUNDS = [
  [-18.6, -82.4],
  [0.5, -68.2],
];

const DEPARTMENTS = [
  { code: "01", name: "Amazonas" },
  { code: "02", name: "Áncash" },
  { code: "03", name: "Apurímac" },
  { code: "04", name: "Arequipa" },
  { code: "05", name: "Ayacucho" },
  { code: "06", name: "Cajamarca" },
  { code: "07", name: "Callao" },
  { code: "08", name: "Cusco" },
  { code: "09", name: "Huancavelica" },
  { code: "10", name: "Huánuco" },
  { code: "11", name: "Ica" },
  { code: "12", name: "Junín" },
  { code: "13", name: "La Libertad" },
  { code: "14", name: "Lambayeque" },
  { code: "15", name: "Lima" },
  { code: "16", name: "Loreto" },
  { code: "17", name: "Madre de Dios" },
  { code: "18", name: "Moquegua" },
  { code: "19", name: "Pasco" },
  { code: "20", name: "Piura" },
  { code: "21", name: "Puno" },
  { code: "22", name: "San Martín" },
  { code: "23", name: "Tacna" },
  { code: "24", name: "Tumbes" },
  { code: "25", name: "Ucayali" },
];

const NAME_TO_CODE = Object.fromEntries(DEPARTMENTS.map((d) => [normalizeName(d.name), d.code]));
const CODE_TO_NAME = Object.fromEntries(DEPARTMENTS.map((d) => [d.code, d.name]));

function normalizeName(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function extractFeatureName(feature) {
  const props = feature?.properties || {};
  const preferred = ["NOMBDEP", "NOMB_DPTO", "NOMBDPTO", "DEPARTAMENTO", "DEPARTAMEN", "NOMBRE", "NAME_1", "name"];

  for (const key of preferred) {
    if (props[key]) return String(props[key]);
  }

  for (const value of Object.values(props)) {
    if (typeof value !== "string") continue;
    const normalized = normalizeName(value);
    if (NAME_TO_CODE[normalized]) return value;
  }

  return "Departamento";
}

function extractFeatureCode(feature) {
  const props = feature?.properties || {};
  const preferred = ["IDDPTO", "CCDD", "CODDEP", "COD_DPTO", "DPTO", "codigo", "code"];

  for (const key of preferred) {
    const raw = props[key];
    if (raw === undefined || raw === null) continue;
    const digits = String(raw).match(/\d{1,2}/)?.[0];
    if (digits) return digits.padStart(2, "0");
  }

  const name = extractFeatureName(feature);
  return NAME_TO_CODE[normalizeName(name)] || "00";
}

function districtLabel(d) {
  const ubigeo = String(d.ubigeo || "").padStart(6, "0");
  const raw = String(d.distrito || "").trim();
  const ref = getUbigeoReference(ubigeo);

  // La data original trae distrito=UBIGEO. Mostramos una etiqueta más entendible.
  if (!raw || raw === ubigeo || /^\d{6}$/.test(raw)) {
    return ref ? `${ref}` : `Distrito UBIGEO ${ubigeo}`;
  }

  return raw;
}

function buildDepartmentSummary(distritos = []) {
  const byCode = new Map();

  for (const meta of DEPARTMENTS) {
    byCode.set(meta.code, {
      ...meta,
      distritos: 0,
      total_ninos: 0,
      casos_anemia: 0,
      cobertura_count: 0,
      organizaciones: [],
      comedores: [],
      distritos_priorizados: [],
    });
  }

  for (const d of distritos) {
    const ubigeo = String(d.ubigeo || "").padStart(6, "0");
    const code = ubigeo.slice(0, 2);
    if (!byCode.has(code)) continue;

    const dep = byCode.get(code);
    const totalNinos = getTotalNinos(d);
    const casosAnemia = getCasosAnemia(d);
    const anemiaPct = getAnemiaPct(d);
    const distritoRiesgo = riskFromAnemia(anemiaPct);

    dep.distritos += 1;
    dep.total_ninos += totalNinos;
    dep.casos_anemia += casosAnemia;
    if (getCoberturaComedor(d)) dep.cobertura_count += 1;

    dep.distritos_priorizados.push({
      ubigeo,
      distrito: districtLabel(d),
      distrito_base: d.distrito,
      zona_referencial: getUbigeoReference(ubigeo),
      provincia: d.provincia || "",
      nivel_riesgo: distritoRiesgo,
      nivel_riesgo_base: d.nivel_riesgo || "SIN_DATOS",
      porcentaje_anemia: anemiaPct,
      total_ninos: totalNinos,
      casos_anemia: casosAnemia,
      tiene_cobertura_comedor: getCoberturaComedor(d),
    });

    for (const org of d.organizaciones || []) {
      if (!dep.organizaciones.some((x) => x.id === org.id)) {
        dep.organizaciones.push({
          ...org,
          distrito: districtLabel(d),
          provincia: d.provincia,
          departamento: d.departamento,
        });
      }
    }

    // Oferta social institucional (ENDES) del distrito, si existe
    if (d.oferta_social) {
      dep.comedores.push({ ubigeo, ...d.oferta_social });
    }
  }

  return Object.fromEntries(
    [...byCode.entries()].map(([code, dep]) => {
      const porcentaje_anemia = dep.total_ninos > 0
        ? (dep.casos_anemia / dep.total_ninos) * 100
        : null;
      const cobertura_comedor_pct = dep.distritos > 0
        ? (dep.cobertura_count / dep.distritos) * 100
        : null;
      const nivel_riesgo_departamental = riskFromDepartmentIndicators(
        porcentaje_anemia,
        cobertura_comedor_pct,
        dep.distritos
      );

      const distritos_priorizados = dep.distritos_priorizados
        .sort((a, b) => {
          const riskDiff = (RISK_SCORE[b.nivel_riesgo] || 0) - (RISK_SCORE[a.nivel_riesgo] || 0);
          if (riskDiff !== 0) return riskDiff;
          const comedorDiff = Number(!a.tiene_cobertura_comedor) - Number(!b.tiene_cobertura_comedor);
          if (comedorDiff !== 0) return comedorDiff;
          return Number(b.porcentaje_anemia || 0) - Number(a.porcentaje_anemia || 0);
        })
        .slice(0, 10);

      return [
        code,
        {
          ...dep,
          nivel_riesgo: nivel_riesgo_departamental,
          porcentaje_anemia,
          cobertura_comedor_pct,
          distritos_priorizados,
        },
      ];
    })
  );
}

function useGeoJson() {
  const [geoData, setGeoData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let lastError = "";
      for (const url of GEOJSON_URLS) {
        try {
          const res = await fetch(url, { cache: "force-cache" });
          if (!res.ok) throw new Error(`${url} (${res.status})`);
          const data = await res.json();
          if (!cancelled) setGeoData(data);
          return;
        } catch (e) {
          lastError = e.message || String(e);
        }
      }
      if (!cancelled) setError(lastError || "Error cargando el mapa");
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { geoData, error };
}

function FitBounds({ geoData }) {
  const map = useMap();

  useEffect(() => {
    if (!geoData) return undefined;
    const timer = setTimeout(() => {
      map.fitBounds(PERU_BOUNDS, { padding: [20, 20] });
    }, 100);
    return () => clearTimeout(timer);
  }, [geoData, map]);

  return null;
}

export default function PeruGeoMap({ distritos = [], onSelect }) {
  const { geoData, error } = useGeoJson();
  const [selectedCode, setSelectedCode] = useState(null);
  const resumen = useMemo(() => buildDepartmentSummary(distritos), [distritos]);

  const totalDistritos = distritos.length;
  const highOrVeryHigh = distritos.filter((d) => {
    const risk = riskFromAnemia(getAnemiaPct(d));
    return risk === "ALTO" || risk === "MUY_ALTO";
  }).length;
  const orgCount = Object.values(resumen).reduce((sum, dep) => sum + dep.organizaciones.length, 0);

  function selectFeature(feature) {
    const code = extractFeatureCode(feature);
    const name = CODE_TO_NAME[code] || extractFeatureName(feature);
    const dep = resumen[code] || {
      code,
      name,
      distritos: 0,
      total_ninos: 0,
      casos_anemia: 0,
      porcentaje_anemia: null,
      cobertura_comedor_pct: null,
      organizaciones: [],
      distritos_priorizados: [],
      nivel_riesgo: "SIN_DATOS",
    };
    setSelectedCode(code);
    onSelect?.({ ...dep, name });
  }

  function styleFeature(feature) {
    const code = extractFeatureCode(feature);
    const dep = resumen[code];
    const active = selectedCode === code;
    return {
      color: active ? "#0f172a" : "#ffffff",
      weight: active ? 3 : 1.2,
      fillColor: colorFor(dep?.nivel_riesgo || "SIN_DATOS"),
      fillOpacity: dep?.distritos ? 0.88 : 0.35,
      opacity: 1,
      dashArray: active ? "" : "2",
      className: "cursor-pointer",
    };
  }

  function onEachFeature(feature, layer) {
    const code = extractFeatureCode(feature);
    const name = CODE_TO_NAME[code] || extractFeatureName(feature);
    const dep = resumen[code];

    layer.bindTooltip(
      `
        <div style="min-width: 230px">
          <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: .04em;">Departamento</div>
          <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">${name}</div>
          <div><b>Riesgo departamental:</b> ${riskLabel(dep?.nivel_riesgo)}</div>
          <div><b>Anemia promedio:</b> ${formatPercent(dep?.porcentaje_anemia)}</div>
          <div><b>Distritos con data:</b> ${formatNumber(dep?.distritos)}</div>
          <div><b>Organizaciones para donar:</b> ${formatNumber(dep?.organizaciones?.length || 0)}</div>
          <div><b>Comedores ENDES:</b> ${formatNumber(dep?.comedores?.length || 0)} distritos</div>
          <div style="margin-top: 6px; color: #475569;">Click para ver detalle territorial y apoyar.</div>
        </div>
      `,
      { sticky: true, direction: "top", opacity: 0.96 }
    );

    layer.on({
      mouseover: (e) => {
        e.target.setStyle({ weight: 3, color: "#0f172a", fillOpacity: 0.96 });
        e.target.bringToFront();
      },
      mouseout: (e) => {
        e.target.setStyle(styleFeature(feature));
      },
      click: () => selectFeature(feature),
    });
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f8fafc_38%,#ecfdf5_100%)] dark:bg-[radial-gradient(circle_at_top_left,#0c243b_0,#0f172a_38%,#062e26_100%)]">
      <div className="absolute left-4 top-4 z-[500] hidden w-[290px] rounded-2xl border border-white/70 bg-white/90 p-3 shadow-lg shadow-slate-200/70 backdrop-blur md:block dark:border-slate-700 dark:bg-slate-800/90 dark:shadow-black/30">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Mapa geográfico real</p>
        <h2 className="mt-0.5 text-base font-extrabold text-slate-900 dark:text-white">Perú por departamentos</h2>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <MapKpi label="Distritos" value={formatNumber(totalDistritos)} />
          <MapKpi label="Alto/muy alto" value={formatNumber(highOrVeryHigh)} />
          <MapKpi label="Org." value={formatNumber(orgCount)} />
        </div>
      </div>

      <div className="absolute bottom-4 left-4 z-[500] hidden rounded-2xl border border-white/80 bg-white/95 p-3 text-sm shadow-lg shadow-slate-200/70 backdrop-blur sm:block dark:border-slate-700 dark:bg-slate-800/95 dark:shadow-black/30">
        <div className="mb-2 font-bold text-slate-800 dark:text-slate-100">Riesgo por anemia promedio</div>
        <LegendItem color={colorFor("MUY_ALTO")} label="Muy alto ≥ 45%" />
        <LegendItem color={colorFor("ALTO")} label="Alto 35%–44.9%" />
        <LegendItem color={colorFor("MEDIO")} label="Medio 25%–34.9%" />
        <LegendItem color={colorFor("BAJO")} label="Bajo < 25%" />
        <LegendItem color={colorFor("SIN_DATOS")} label="Sin datos" />
        <div className="mt-3 border-t pt-2 text-[11px] leading-4 text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Fuente de riesgo: ENDES 2024 / INEI.<br />Límites: GeoJSON departamental.
        </div>
      </div>

      {error && (
        <div className="absolute inset-0 z-[600] grid place-items-center bg-white/90 p-6 dark:bg-slate-900/90">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-lg">
            <h3 className="font-bold">No se pudo cargar el mapa detallado</h3>
            <p className="mt-2 text-sm">{error}</p>
            <p className="mt-2 text-sm">
              Coloca <b>peru_departamental_simple.geojson</b> en <b>frontend/public</b> o revisa tu conexión.
            </p>
          </div>
        </div>
      )}

      {!geoData && !error && (
        <div className="absolute inset-0 z-[600] grid place-items-center bg-slate-50/70 dark:bg-slate-900/70">
          <div className="w-64 rounded-2xl border bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Cargando límites del Perú…</p>
            <div className="nm-skeleton mt-3 h-3 w-full animate-shimmer rounded-full" />
            <div className="nm-skeleton mt-2 h-3 w-2/3 animate-shimmer rounded-full" />
          </div>
        </div>
      )}

      <MapContainer
        center={PERU_CENTER}
        zoom={5}
        minZoom={5}
        maxZoom={8}
        maxBounds={PERU_BOUNDS}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full bg-transparent"
        style={{ background: "transparent" }}
      >
        <ZoomControl position="bottomright" />
        <FitBounds geoData={geoData} />
        {geoData && (
          <GeoJSON
            key={`peru-${selectedCode || "none"}-${distritos.length}`}
            data={geoData}
            style={styleFeature}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2 py-1 text-slate-700 dark:text-slate-300">
      <span className="h-3.5 w-3.5 rounded-md shadow-sm" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function MapKpi({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-700/60">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-base font-extrabold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
