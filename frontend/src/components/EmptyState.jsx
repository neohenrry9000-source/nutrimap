export default function EmptyState({
  title = "No se encontraron resultados",
  message = "Prueba cambiar los filtros o limpiar la búsqueda para volver a ver información en el mapa.",
}) {
  return (
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-amber-100 text-2xl">
        🔎
      </div>
      <h3 className="text-lg font-extrabold text-slate-800">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
    </div>
  );
}