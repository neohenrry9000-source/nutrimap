export default function DashboardGuide() {
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
    <section className="border-b border-slate-200 bg-white px-5 py-3">
      <div className="grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <h3 className="text-sm font-bold text-slate-800">{item.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {item.text}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
