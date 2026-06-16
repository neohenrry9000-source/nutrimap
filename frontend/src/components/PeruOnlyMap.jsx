import { useMemo, useState } from "react";
import { colorFor } from "../utils/colors.js";

const RISK_SCORE = {
  SIN_DATOS: 0,
  BAJO: 1,
  MEDIO: 2,
  ALTO: 3,
  MUY_ALTO: 4,
};

const SCORE_TO_RISK = (score) => {
  if (!score || score <= 0.25) return "SIN_DATOS";
  if (score < 1.6) return "BAJO";
  if (score < 2.5) return "MEDIO";
  if (score < 3.35) return "ALTO";
  return "MUY_ALTO";
};

const DEPARTMENTS = [
  { code: "24", name: "Tumbes", label: [70, 34], path: "M48 16 L95 22 L102 54 L70 74 L42 58 Z" },
  { code: "20", name: "Piura", label: [76, 105], path: "M42 60 L73 76 L116 64 L135 111 L118 158 L72 162 L38 126 Z" },
  { code: "14", name: "Lambayeque", label: [89, 181], path: "M72 162 L120 158 L141 196 L116 222 L73 209 Z" },
  { code: "06", name: "Cajamarca", label: [150, 132], path: "M116 64 L178 72 L205 122 L190 181 L141 196 L120 158 L135 111 Z" },
  { code: "01", name: "Amazonas", label: [225, 100], path: "M178 72 L260 52 L316 92 L298 151 L232 158 L205 122 Z" },
  { code: "16", name: "Loreto", label: [335, 153], path: "M260 52 L383 62 L420 123 L403 220 L336 267 L276 226 L298 151 L316 92 Z" },
  { code: "13", name: "La Libertad", label: [125, 249], path: "M73 209 L116 222 L165 218 L184 269 L151 315 L88 294 L63 245 Z" },
  { code: "22", name: "San Martín", label: [237, 242], path: "M190 181 L232 158 L298 151 L276 226 L293 286 L240 327 L184 269 L165 218 Z" },
  { code: "02", name: "Áncash", label: [132, 346], path: "M88 294 L151 315 L178 368 L160 423 L101 409 L68 357 Z" },
  { code: "10", name: "Huánuco", label: [212, 354], path: "M151 315 L184 269 L240 327 L245 383 L203 430 L178 368 Z" },
  { code: "19", name: "Pasco", label: [231, 441], path: "M203 430 L245 383 L281 422 L263 478 L215 486 Z" },
  { code: "25", name: "Ucayali", label: [323, 375], path: "M276 226 L336 267 L378 347 L356 451 L281 422 L245 383 L240 327 L293 286 Z" },
  { code: "15", name: "Lima", label: [130, 459], path: "M101 409 L160 423 L215 486 L190 548 L126 535 L85 468 Z" },
  { code: "07", name: "Callao", label: [84, 462], path: "M75 448 L94 453 L91 475 L72 470 Z" },
  { code: "12", name: "Junín", label: [235, 516], path: "M215 486 L263 478 L309 532 L292 597 L225 595 L190 548 Z" },
  { code: "09", name: "Huancavelica", label: [186, 604], path: "M190 548 L225 595 L218 650 L159 632 L126 535 Z" },
  { code: "11", name: "Ica", label: [132, 647], path: "M126 535 L159 632 L176 700 L126 682 L93 602 Z" },
  { code: "05", name: "Ayacucho", label: [232, 670], path: "M218 650 L225 595 L292 597 L313 674 L276 732 L218 719 Z" },
  { code: "03", name: "Apurímac", label: [306, 722], path: "M276 732 L313 674 L357 694 L354 753 L304 769 Z" },
  { code: "08", name: "Cusco", label: [351, 635], path: "M292 597 L309 532 L356 451 L399 524 L392 616 L357 694 L313 674 Z" },
  { code: "17", name: "Madre de Dios", label: [427, 505], path: "M356 451 L440 410 L507 467 L485 557 L399 524 Z" },
  { code: "04", name: "Arequipa", label: [230, 791], path: "M176 700 L218 719 L276 732 L304 769 L286 842 L212 867 L159 816 Z" },
  { code: "21", name: "Puno", label: [376, 801], path: "M354 753 L357 694 L392 616 L467 665 L484 766 L435 848 L373 833 Z" },
  { code: "18", name: "Moquegua", label: [294, 895], path: "M286 842 L373 833 L385 887 L328 927 L273 910 Z" },
  { code: "23", name: "Tacna", label: [350, 962], path: "M328 927 L385 887 L436 929 L421 986 L357 1002 L314 973 Z" },
];

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Sin datos";
  return `${Number(value).toFixed(1)}%`;
}

function riskLabel(nivel) {
  return (nivel || "SIN_DATOS").replace("_", " ");
}

function buildDepartmentSummary(distritos = []) {
  const byCode = new Map();

  for (const d of distritos) {
    const ubigeo = String(d.ubigeo || "").padStart(6, "0");
    const code = ubigeo.slice(0, 2);
    const meta = DEPARTMENTS.find((dep) => dep.code === code);
    if (!meta) continue;

    if (!byCode.has(code)) {
      byCode.set(code, {
        ...meta,
        distritos: 0,
        total_ninos: 0,
        casos_anemia: 0,
        cobertura_count: 0,
        score_sum: 0,
        score_count: 0,
        organizaciones: [],
      });
    }

    const dep = byCode.get(code);
    dep.distritos += 1;
    dep.total_ninos += Number(d.total_ninos || 0);
    dep.casos_anemia += Number(d.casos_anemia || 0);
    if (d.tiene_cobertura_comedor) dep.cobertura_count += 1;

    const score = RISK_SCORE[d.nivel_riesgo] ?? 0;
    if (score > 0) {
      dep.score_sum += score;
      dep.score_count += 1;
    }

    for (const org of d.organizaciones || []) {
      if (!dep.organizaciones.some((x) => x.id === org.id)) {
        dep.organizaciones.push({ ...org, distrito: d.distrito, departamento: d.departamento });
      }
    }
  }

  return DEPARTMENTS.map((meta) => {
    const dep = byCode.get(meta.code) || {
      ...meta,
      distritos: 0,
      total_ninos: 0,
      casos_anemia: 0,
      cobertura_count: 0,
      score_sum: 0,
      score_count: 0,
      organizaciones: [],
    };

    const porcentaje_anemia = dep.total_ninos > 0
      ? (dep.casos_anemia / dep.total_ninos) * 100
      : null;
    const cobertura_comedor_pct = dep.distritos > 0
      ? (dep.cobertura_count / dep.distritos) * 100
      : null;
    const avgScore = dep.score_count > 0 ? dep.score_sum / dep.score_count : 0;

    return {
      ...dep,
      nivel_riesgo: SCORE_TO_RISK(avgScore),
      porcentaje_anemia,
      cobertura_comedor_pct,
    };
  });
}

export default function PeruOnlyMap({ distritos = [], onSelect }) {
  const [hovered, setHovered] = useState(null);
  const [selectedCode, setSelectedCode] = useState(null);
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0 });

  const departamentos = useMemo(() => buildDepartmentSummary(distritos), [distritos]);

  const handleClick = (dep) => {
    setSelectedCode(dep.code);
    onSelect?.(dep);
  };

  const handleMove = (e, dep) => {
    setHovered(dep);
    setTooltip({ visible: true, x: e.clientX + 16, y: e.clientY + 16 });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      <div className="absolute left-4 top-4 z-10 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapa esquemático</p>
        <h2 className="text-lg font-bold text-slate-800">Perú por departamentos</h2>
        <p className="max-w-xs text-xs text-slate-500">
          Pasa el mouse para ver indicadores y haz click para ver organizaciones inscritas.
        </p>
      </div>

      <div className="absolute bottom-4 left-4 z-10 rounded-xl border border-slate-200 bg-white/95 p-3 text-sm shadow-sm backdrop-blur">
        <div className="mb-2 font-semibold text-slate-700">Nivel de riesgo</div>
        <LegendItem color={colorFor("BAJO")} label="Bajo" />
        <LegendItem color={colorFor("MEDIO")} label="Medio" />
        <LegendItem color={colorFor("ALTO")} label="Alto" />
        <LegendItem color={colorFor("MUY_ALTO")} label="Muy alto" />
        <LegendItem color={colorFor("SIN_DATOS")} label="Sin datos" />
      </div>

      <div className="flex h-full items-center justify-center p-6 pt-20">
        <svg
          viewBox="0 0 540 1020"
          className="h-full max-h-[920px] w-full max-w-[560px] drop-shadow-sm"
          role="img"
          aria-label="Mapa del Perú por departamentos"
        >
          <defs>
            <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.18" />
            </filter>
          </defs>

          <g filter="url(#softShadow)">
            {departamentos.map((dep) => {
              const active = selectedCode === dep.code;
              const isHovered = hovered?.code === dep.code;
              return (
                <g key={dep.code}>
                  <path
                    d={dep.path}
                    fill={colorFor(dep.nivel_riesgo)}
                    stroke={active || isHovered ? "#0f172a" : "#ffffff"}
                    strokeWidth={active || isHovered ? 3.5 : 2}
                    opacity={dep.distritos ? 0.92 : 0.55}
                    className="cursor-pointer transition-all duration-150 hover:brightness-105"
                    onMouseMove={(e) => handleMove(e, dep)}
                    onMouseLeave={() => {
                      setHovered(null);
                      setTooltip({ visible: false, x: 0, y: 0 });
                    }}
                    onClick={() => handleClick(dep)}
                  />
                  <text
                    x={dep.label[0]}
                    y={dep.label[1]}
                    textAnchor="middle"
                    className="pointer-events-none select-none fill-slate-800 text-[12px] font-bold"
                  >
                    {dep.name.length > 11 ? dep.name.slice(0, 10) + "." : dep.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {tooltip.visible && hovered && (
        <div
          className="pointer-events-none fixed z-[3000] w-64 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">Departamento</p>
              <h3 className="text-base font-bold text-slate-800">{hovered.name}</h3>
            </div>
            <span className="rounded-full px-2 py-1 text-[11px] font-bold text-white" style={{ background: colorFor(hovered.nivel_riesgo) }}>
              {riskLabel(hovered.nivel_riesgo)}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <MiniStat label="Anemia" value={formatPercent(hovered.porcentaje_anemia)} />
            <MiniStat label="Distritos" value={hovered.distritos} />
            <MiniStat label="Comedores" value={formatPercent(hovered.cobertura_comedor_pct)} />
            <MiniStat label="Organiz." value={hovered.organizaciones.length} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Click para ver las organizaciones inscritas.</p>
        </div>
      )}
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <div className="flex items-center gap-2 py-0.5 text-slate-600">
      <span className="h-3.5 w-3.5 rounded" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-2">
      <div className="text-[10px] uppercase text-slate-500">{label}</div>
      <div className="font-semibold text-slate-800">{value}</div>
    </div>
  );
}
