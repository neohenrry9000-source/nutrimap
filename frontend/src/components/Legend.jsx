import { NIVELES } from "../utils/colors.js";

export default function Legend() {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white/95 backdrop-blur
                    rounded-lg shadow-lg p-3 text-sm border border-slate-200">
      <div className="font-semibold mb-2 text-slate-700">Riesgo de anemia infantil</div>
      <ul className="space-y-1">
        {NIVELES.map((n) => (
          <li key={n.key} className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded"
                  style={{ background: n.color }} />
            <span>{n.label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 pt-2 border-t text-[11px] text-slate-500">
        Fuente: ENDES 2024 / INEI
      </div>
    </div>
  );
}
