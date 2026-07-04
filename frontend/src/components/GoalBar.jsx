// Barra de meta/recaudación. Se usa en cards de organización, panel
// financiero y strip global.
function fmtMonto(v, moneda = "PEN") {
  const simbolo = moneda === "USD" ? "$" : "S/";
  return `${simbolo} ${Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export default function GoalBar({ titulo, recaudado = 0, objetivo = 1, moneda = "PEN", compact = false }) {
  const pct = Math.min(100, (Number(recaudado) / Math.max(1, Number(objetivo))) * 100);
  const done = pct >= 100;

  return (
    <div className={compact ? "" : "rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60"}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`truncate font-semibold ${compact ? "text-slate-600 dark:text-slate-300" : "text-slate-700 dark:text-slate-200"}`}>
          {titulo || "Meta de recaudación"}
        </span>
        <span className="shrink-0 font-bold text-slate-800 dark:text-slate-100">
          {fmtMonto(recaudado, moneda)} <span className="font-normal text-slate-400">/ {fmtMonto(objetivo, moneda)}</span>
        </span>
      </div>
      <div
        className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}
      >
        <div
          className={`relative h-full overflow-hidden rounded-full transition-[width] duration-700 ease-out-expo ${done ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-500 to-teal-400"}`}
          style={{ width: `${pct}%` }}
        >
          {/* sheen sutil que recorre el relleno */}
          {pct > 4 && (
            <span className="nm-skeleton absolute inset-0 animate-shimmer opacity-25 mix-blend-overlay" aria-hidden="true" />
          )}
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className={done ? "font-bold text-emerald-600 dark:text-emerald-400" : "text-slate-400"}>
          {done ? "🎉 ¡Meta alcanzada!" : `${pct.toFixed(0)}% alcanzado`}
        </span>
      </div>
    </div>
  );
}
