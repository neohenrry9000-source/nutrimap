// Onboarding contextual de primera visita (3 pasos, se guarda en localStorage).
import { useState } from "react";

const KEY = "nm_onboarding_done";

const PASOS = [
  {
    icon: "🗺️",
    titulo: "Explora el mapa",
    texto: "Cada departamento está coloreado según el riesgo de anemia infantil (ENDES 2024). Pasa el mouse para indicadores y haz click para abrir el detalle territorial.",
  },
  {
    icon: "🎯",
    titulo: "Prioriza y filtra",
    texto: "Usa la búsqueda y los filtros rápidos para encontrar distritos críticos, zonas sin comedor y organizaciones inscritas. Presiona “/” para buscar al instante.",
  },
  {
    icon: "💚",
    titulo: "Apoya donde más se necesita",
    texto: "Dentro de cada departamento verás organizaciones para apoyar con tarjeta o Yape — incluso de forma anónima. Tu panel guarda todo tu historial.",
  },
];

export default function OnboardingTips() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(KEY));
  const [paso, setPaso] = useState(0);

  if (!visible) return null;

  const cerrar = () => {
    localStorage.setItem(KEY, "1");
    setVisible(false);
  };

  const p = PASOS[paso];
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="fixed inset-0 z-[2100] flex animate-overlay-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm animate-scale-in rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-3xl dark:bg-emerald-900/60">{p.icon}</div>
        <h3 className="mt-3 text-lg font-extrabold text-slate-900 dark:text-white">{p.titulo}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{p.texto}</p>

        <div className="mt-4 flex justify-center gap-1.5">
          {PASOS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === paso ? "w-6 bg-emerald-500" : "w-1.5 bg-slate-300 dark:bg-slate-600"}`} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={cerrar} className="px-3 py-2 text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            Saltar
          </button>
          <button
            onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))}
            className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            {ultimo ? "¡Empezar!" : "Siguiente"}
          </button>
        </div>
      </div>
    </div>
  );
}
