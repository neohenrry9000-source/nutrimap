import { useState } from "react";

const STORAGE_KEY = "nm_guide_open";

export default function DashboardGuide() {
  // Colapsada por defecto: el mapa es el protagonista. Se recuerda la
  // preferencia del usuario entre sesiones.
  const [open, setOpen] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  };

  const items = [
    {
      title: "Filtra zonas",
      text: "Busca por departamento, provincia, distrito o UBIGEO.",
    },
    {
      title: "Prioriza riesgos",
      text: "Identifica distritos con anemia alta o muy alta.",
    },
    {
      title: "Evalúa cobertura",
      text: "Revisa zonas con menor presencia de comedores u organizaciones.",
    },
  ];

  return (
    <section className="border-b border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between py-1.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span>Guía rápida del dashboard</span>
        <span className="text-sm">{open ? "▴ Ocultar" : "▾ Mostrar"}</span>
      </button>

      {open && (
        <div className="grid animate-fade-up gap-3 pb-3 md:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60"
            >
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}