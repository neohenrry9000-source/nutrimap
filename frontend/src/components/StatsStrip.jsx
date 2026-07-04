// Strip global: métricas de impacto + barra de meta global.
// Delgado, colapsable y con preferencia recordada.
import { useEffect, useState } from "react";
import { api } from "../services/api.js";
import GoalBar from "./GoalBar.jsx";

const KEY = "nm_stats_open";

function fmtPen(totales = {}) {
  const partes = Object.entries(totales).map(
    ([m, v]) => `${m === "USD" ? "$" : "S/"} ${Number(v).toLocaleString("es-PE")}`
  );
  return partes.length ? partes.join(" · ") : "S/ 0";
}

export default function StatsStrip() {
  const [stats, setStats] = useState(null);
  const [metaGlobal, setMetaGlobal] = useState(null);
  const [open, setOpen] = useState(() => localStorage.getItem(KEY) !== "0");

  useEffect(() => {
    api.stats().then((r) => setStats(r.data)).catch(() => {});
    api.metas().then((r) => {
      setMetaGlobal((r.data || []).find((m) => m.tipo === "global") || null);
    }).catch(() => {});
  }, []);

  const toggle = () => {
    setOpen((v) => {
      localStorage.setItem(KEY, v ? "0" : "1");
      return !v;
    });
  };

  if (!stats && !metaGlobal) return null;

  return (
    <section className="border-b border-slate-200 bg-emerald-50/60 px-4 dark:border-slate-700 dark:bg-slate-800/60">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1 text-left text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        <span>Impacto solidario</span>
        <span>{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pb-2">
          {stats && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
              <span>💚 <b className="text-slate-900 dark:text-white">{fmtPen(stats.total_donado)}</b> donados</span>
              <span>🤝 <b className="text-slate-900 dark:text-white">{stats.donaciones}</b> donaciones
                {stats.donaciones_semana > 0 && <span className="text-emerald-600 dark:text-emerald-400"> (+{stats.donaciones_semana} esta semana)</span>}
              </span>
              <span>🏠 <b className="text-slate-900 dark:text-white">{stats.organizaciones_activas}</b> organizaciones en <b className="text-slate-900 dark:text-white">{stats.departamentos_con_orgs}</b> deptos.</span>
              {stats.distritos_con_oferta_social > 0 && (
                <span>🍲 <b className="text-slate-900 dark:text-white">{stats.distritos_con_oferta_social}</b> distritos con comedores (ENDES)</span>
              )}
            </div>
          )}
          {metaGlobal && (
            <div className="min-w-[240px] flex-1">
              <GoalBar
                compact
                titulo={`🎯 ${metaGlobal.titulo}`}
                recaudado={metaGlobal.recaudado}
                objetivo={metaGlobal.objetivo_monto}
                moneda={metaGlobal.moneda}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
