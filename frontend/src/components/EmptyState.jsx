import { MapSearchIllustration } from "./illustrations.jsx";

export default function EmptyState({
  title = "No se encontraron resultados",
  message = "Prueba cambiar los filtros o limpiar la búsqueda para volver a ver información en el mapa.",
  action = null,
}) {
  return (
    <div className="max-w-md animate-fade-up rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <MapSearchIllustration className="mx-auto -mt-1 h-32 w-44 animate-float text-slate-900 dark:text-white" />
      <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
