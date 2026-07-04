// Ranking de departamentos por riesgo + comparador de dos territorios.
import { useMemo, useState } from "react";
import { colorFor } from "../utils/colors.js";
import {
  formatNumber, formatPercent, getAnemiaPct, getCasosAnemia,
  getCoberturaComedor, getTotalNinos, riskFromDepartmentIndicators, riskLabel,
} from "../utils/riskRules.js";
import { DEPARTAMENTOS, departamentoName } from "../utils/departamentos.js";

function resumenPorDepartamento(distritos) {
  const acc = {};
  for (const d of distritos) {
    const code = String(d.ubigeo || "").padStart(6, "0").slice(0, 2);
    const a = (acc[code] ||= {
      code, name: departamentoName(code) || code,
      distritos: 0, ninos: 0, casos: 0, conComedor: 0, orgs: 0, comedoresEndes: 0,
    });
    a.distritos += 1;
    a.ninos += getTotalNinos(d);
    a.casos += getCasosAnemia(d);
    if (getCoberturaComedor(d)) a.conComedor += 1;
    a.orgs += (d.organizaciones || []).length;
    if (d.oferta_social) a.comedoresEndes += 1;
  }
  return Object.values(acc).map((a) => {
    const anemia = a.ninos > 0 ? (a.casos / a.ninos) * 100 : null;
    const cobertura = a.distritos > 0 ? (a.conComedor / a.distritos) * 100 : null;
    return {
      ...a,
      anemia,
      cobertura,
      riesgo: riskFromDepartmentIndicators(anemia, cobertura, a.distritos),
    };
  }).sort((x, y) => (y.anemia ?? -1) - (x.anemia ?? -1));
}

export default function RankingModal({ distritos, favoritos, toggleFavorito, onClose }) {
  const ranking = useMemo(() => resumenPorDepartamento(distritos), [distritos]);
  const [compA, setCompA] = useState("");
  const [compB, setCompB] = useState("");

  const a = ranking.find((r) => r.code === compA);
  const b = ranking.find((r) => r.code === compB);

  return (
    <div className="fixed inset-0 z-[2000] flex animate-overlay-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl animate-scale-in flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">Ranking de departamentos</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Ordenado por anemia promedio (mayor = más prioritario). ⭐ marca tus favoritos.</p>
          </div>
          <button onClick={onClose} className="rounded-full px-2 text-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700">×</button>
        </div>

        {/* Comparador */}
        <div className="border-b bg-slate-50 px-5 py-3 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Comparar territorios</p>
          <div className="flex flex-wrap items-center gap-2">
            {[["A", compA, setCompA], ["B", compB, setCompB]].map(([label, val, set]) => (
              <select key={label} value={val} onChange={(e) => set(e.target.value)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">
                <option value="">Departamento {label}…</option>
                {DEPARTAMENTOS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            ))}
          </div>
          {a && b && (
            <div className="mt-3 grid grid-cols-[1fr_auto_1fr] gap-x-3 gap-y-1 rounded-xl border bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-700/60">
              <span className="font-extrabold text-slate-900 dark:text-white">{a.name}</span>
              <span className="text-xs text-slate-400">vs</span>
              <span className="text-right font-extrabold text-slate-900 dark:text-white">{b.name}</span>
              {[
                ["Anemia promedio", formatPercent(a.anemia), formatPercent(b.anemia)],
                ["Riesgo", riskLabel(a.riesgo), riskLabel(b.riesgo)],
                ["Distritos con data", formatNumber(a.distritos), formatNumber(b.distritos)],
                ["Niños evaluados", formatNumber(a.ninos), formatNumber(b.ninos)],
                ["Cobertura comedor", formatPercent(a.cobertura), formatPercent(b.cobertura)],
                ["Organizaciones", formatNumber(a.orgs), formatNumber(b.orgs)],
                ["Distritos c/ comedor ENDES", formatNumber(a.comedoresEndes), formatNumber(b.comedoresEndes)],
              ].map(([k, va, vb]) => (
                <FilaComparacion key={k} k={k} va={va} vb={vb} />
              ))}
            </div>
          )}
        </div>

        {/* Ranking */}
        <div className="flex-1 overflow-y-auto p-3">
          {ranking.map((r, i) => (
            <div key={r.code} className="mb-1.5 flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
              <span className="w-6 text-center text-sm font-extrabold text-slate-400">{i + 1}</span>
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: colorFor(r.riesgo) }} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{r.name}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatPercent(r.anemia)} anemia · {r.distritos} distritos · {r.orgs} org. · {r.comedoresEndes} c/ comedor ENDES
                </p>
              </div>
              <button
                onClick={() => toggleFavorito(r.code)}
                aria-label={`Favorito ${r.name}`}
                className={`text-lg ${favoritos.includes(r.code) ? "" : "opacity-30 grayscale hover:opacity-70"}`}
              >
                ⭐
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FilaComparacion({ k, va, vb }) {
  return (
    <>
      <span className="text-slate-700 dark:text-slate-200">{va}</span>
      <span className="text-center text-[11px] text-slate-400">{k}</span>
      <span className="text-right text-slate-700 dark:text-slate-200">{vb}</span>
    </>
  );
}
