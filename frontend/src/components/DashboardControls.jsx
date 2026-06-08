import { colorFor } from "../utils/colors.js";
import { formatNumber, formatPercent, getAnemiaPct, getCasosAnemia, getCoberturaComedor, getTotalNinos, riskFromAnemia, riskLabel } from "../utils/riskRules.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";

function calcSummary(distritos) {
  const total = distritos.length;
  const totalNinos = distritos.reduce((s, d) => s + getTotalNinos(d), 0);
  const casos = distritos.reduce((s, d) => s + getCasosAnemia(d), 0);
  const anemia = totalNinos > 0 ? (casos / totalNinos) * 100 : null;
  const sinComedor = distritos.filter((d) => !getCoberturaComedor(d)).length;
  const altoMuyAlto = distritos.filter((d) => {
    const r = riskFromAnemia(getAnemiaPct(d));
    return r === "ALTO" || r === "MUY_ALTO";
  }).length;
  return { total, totalNinos, casos, anemia, sinComedor, altoMuyAlto };
}

function districtLabel(d) {
  const ubigeo = String(d.ubigeo || "").padStart(6, "0");
  const raw = String(d.distrito || "").trim();
  const ref = getUbigeoReference(ubigeo);
  if (!raw || raw === ubigeo || /^\d{6}$/.test(raw)) return ref || `UBIGEO ${ubigeo}`;
  return raw;
}

function topPriority(distritos) {
  return [...distritos]
    .map((d) => ({
      ...d,
      riesgo_calculado: riskFromAnemia(getAnemiaPct(d)),
      etiqueta: districtLabel(d),
    }))
    .sort((a, b) => {
      const score = { SIN_DATOS: 0, BAJO: 1, MEDIO: 2, ALTO: 3, MUY_ALTO: 4 };
      const riskDiff = score[b.riesgo_calculado] - score[a.riesgo_calculado];
      if (riskDiff !== 0) return riskDiff;
      const comedorDiff = Number(!a.tiene_cobertura_comedor) - Number(!b.tiene_cobertura_comedor);
      if (comedorDiff !== 0) return comedorDiff;
      return Number(b.porcentaje_anemia || 0) - Number(a.porcentaje_anemia || 0);
    })
    .slice(0, 5);
}

export default function DashboardControls({ distritos, filters, setFilters, onExport }) {
  const summary = calcSummary(distritos);
  const top = topPriority(distritos);

  return (
    <section className="border-b bg-white px-5 py-3">
      <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi title="Distritos filtrados" value={formatNumber(summary.total)} />
            <Kpi title="Anemia promedio" value={formatPercent(summary.anemia)} />
            <Kpi title="Alto/muy alto" value={formatNumber(summary.altoMuyAlto)} />
            <Kpi title="Sin comedor" value={formatNumber(summary.sinComedor)} />
            <Kpi title="Niños evaluados" value={formatNumber(summary.totalNinos)} />
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_170px_190px_150px]">
            <input
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Buscar por UBIGEO, departamento, provincia o localidad"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <select
              value={filters.risk}
              onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="TODOS">Todos los niveles</option>
              <option value="MUY_ALTO">Muy alto</option>
              <option value="ALTO">Alto</option>
              <option value="MEDIO">Medio</option>
              <option value="BAJO">Bajo</option>
              <option value="SIN_DATOS">Sin datos</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.onlyNoComedor}
                onChange={(e) => setFilters((f) => ({ ...f, onlyNoComedor: e.target.checked }))}
                className="h-4 w-4 accent-emerald-600"
              />
              Solo sin comedor
            </label>
            <button
              onClick={onExport}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-800">Top distritos priorizados</h3>
            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-500">demo académico</span>
          </div>
          <div className="grid gap-2 md:grid-cols-5 xl:grid-cols-1">
            {top.map((d) => (
              <div key={d.ubigeo} className="flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-xs shadow-sm">
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-800">{d.etiqueta}</p>
                  <p className="text-slate-500">{d.departamento} · {d.ubigeo} · {formatPercent(d.porcentaje_anemia)}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ background: colorFor(d.riesgo_calculado) }}>
                  {riskLabel(d.riesgo_calculado)}
                </span>
              </div>
            ))}
            {!top.length && <p className="text-sm text-slate-500">No hay resultados con los filtros actuales.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Kpi({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{title}</div>
      <div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}
