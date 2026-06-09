import OrgCard from "./OrgCard.jsx";
import { colorFor } from "../utils/colors.js";

export default function SidePanel({ distrito, onClose, onHelp }) {
  if (!distrito) {
    return (
      <aside className="w-96 bg-white border-l p-6 overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-700">Selecciona un distrito</h2>
        <p className="text-sm text-slate-500 mt-2">
          Haz clic en cualquier punto del mapa para ver el nivel de
          anemia infantil, la cobertura de comedores populares y las
          organizaciones registradas en la zona.
        </p>
      </aside>
    );
  }
  const c = colorFor(distrito.nivel_riesgo);
  return (
    <aside className="w-96 bg-white border-l p-5 overflow-y-auto">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">
            {distrito.departamento}
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            UBIGEO {distrito.ubigeo}
          </h2>
        </div>
        <button onClick={onClose}
                className="text-slate-400 hover:text-slate-700 text-xl">×</button>
      </div>

      <div className="mt-4 rounded-lg p-3 text-white" style={{ background: c }}>
        <div className="text-sm uppercase tracking-wide opacity-90">Nivel de riesgo</div>
        <div className="text-2xl font-bold">{distrito.nivel_riesgo.replace("_"," ")}</div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="% Anemia" value={`${distrito.porcentaje_anemia ?? "-"}%`} />
        <Stat label="Niños evaluados" value={distrito.total_ninos} />
        <Stat label="Casos detectados" value={distrito.casos_anemia} />
        <Stat label="Cobertura comedor"
              value={distrito.tiene_cobertura_comedor ? "Sí" : "No"} />
      </dl>

      <div className="mt-5">
        <h3 className="font-semibold text-slate-700 mb-2">
          Organizaciones registradas
        </h3>
        {distrito.organizaciones?.length ? (
          <div className="space-y-3">
            {distrito.organizaciones.map((o) => (
              <OrgCard key={o.id} org={o} onHelp={onHelp} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">
            Aún no hay ollas comunes ni comedores populares registrados en
            este distrito. Si conoces alguno, invítale a unirse.
          </p>
        )}
      </div>
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-50 rounded p-2">
      <div className="text-[11px] text-slate-500 uppercase">{label}</div>
      <div className="text-base font-semibold text-slate-800">{value}</div>
    </div>
  );
}
