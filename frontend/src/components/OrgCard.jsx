export default function OrgCard({ org, onHelp }) {
  // sanitización mínima: solo mostramos texto, nunca innerHTML
  const necesidadColor = ["bg-emerald-100","bg-emerald-200","bg-amber-200","bg-orange-300","bg-red-400"];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="font-semibold text-slate-800">{org.nombre}</div>
          <div className="text-xs text-slate-500">{org.tipo.replace("_"," ")}</div>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded ${necesidadColor[org.nivel_necesidad-1]}`}>
          N{org.nivel_necesidad}/5
        </span>
      </div>
      {org.descripcion && (
        <p className="text-sm text-slate-600 mt-2 line-clamp-3">{org.descripcion}</p>
      )}
      <button
        onClick={() => onHelp(org)}
        className="mt-3 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded">
        Ayudar
      </button>
    </div>
  );
}
