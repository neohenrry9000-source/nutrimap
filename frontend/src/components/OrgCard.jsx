import Avatar from "./Avatar.jsx";
import GoalBar from "./GoalBar.jsx";

const TIPO_ICON = { olla_comun: "🍲", comedor_popular: "🏠", otro: "🤝" };

export default function OrgCard({ org, onHelp, meta }) {
  // sanitización mínima: solo mostramos texto, nunca innerHTML
  const necesidadColor = ["bg-emerald-100 text-emerald-800","bg-emerald-200 text-emerald-900","bg-amber-200 text-amber-900","bg-orange-300 text-orange-950","bg-red-400 text-white"];
  return (
    <div className="nm-lift rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex justify-between items-start gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={org.avatar_url} nombre={org.nombre} size="md" />
          <div className="min-w-0">
            <div className="truncate font-bold text-slate-800 dark:text-slate-100">
              {TIPO_ICON[org.tipo] || "🤝"} {org.nombre}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{String(org.tipo || "").replace("_", " ")}</div>
          </div>
        </div>
        <span className={`shrink-0 text-xs font-bold px-2 py-1 rounded-full ${necesidadColor[org.nivel_necesidad - 1] || necesidadColor[2]}`}
              title={`Nivel de necesidad ${org.nivel_necesidad} de 5`}>
          N{org.nivel_necesidad}/5
        </span>
      </div>
      {org.descripcion && (
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">{org.descripcion}</p>
      )}
      {meta && (
        <div className="mt-2">
          <GoalBar compact titulo={`🎯 ${meta.titulo}`} recaudado={meta.recaudado}
                   objetivo={meta.objetivo_monto} moneda={meta.moneda} />
        </div>
      )}
      <button
        onClick={() => onHelp(org)}
        className="nm-press mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-sm shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-md hover:shadow-emerald-600/30">
        💚 Ayudar ahora
      </button>
    </div>
  );
}
