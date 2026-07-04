import { useState } from "react";
import OrgCard from "./OrgCard.jsx";
import { colorFor } from "../utils/colors.js";
import {
  formatNumber,
  formatPercent,
  getAnemiaPct,
  getCasosAnemia,
  getCoberturaComedor,
  getTotalNinos,
  RISK_SCORE,
  riskFromAnemia,
  riskLabel,
} from "../utils/riskRules.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";

function recommendation(dep) {
  if (!dep) return "Selecciona un departamento para generar una lectura territorial.";
  const risk = RISK_SCORE[dep.nivel_riesgo] || 0;
  const orgs = dep.organizaciones?.length || 0;
  const coverage = Number(dep.cobertura_comedor_pct || 0);

  if (risk >= 4 && orgs === 0) {
    return "Prioridad crítica: riesgo departamental muy alto y sin organizaciones inscritas. Conviene registrar aliados locales y focalizar campañas de apoyo.";
  }
  if (risk >= 3 && coverage < 35) {
    return "Prioridad alta: riesgo elevado y cobertura de comedores limitada. Se recomienda orientar donaciones y coordinación comunitaria.";
  }
  if (orgs > 0) {
    return "Hay organizaciones inscritas. El panel permite identificar actores locales y canalizar donaciones hacia zonas priorizadas.";
  }
  return "Territorio con información disponible. Revisa los distritos priorizados antes de decidir intervención.";
}

function districtName(d) {
  const ubigeo = String(d.ubigeo || "").padStart(6, "0");
  const raw = String(d.distrito || d.nombre_distrito || d.distrito_base || "").trim();
  const ref = d.zona_referencial || getUbigeoReference(ubigeo);

  if (!raw || raw === ubigeo || /^\d{6}$/.test(raw)) {
    return ref || `Distrito UBIGEO ${ubigeo}`;
  }
  return raw;
}

export default function DepartmentSidePanel({
  departamento, onClose, onHelp,
  metasByOrg = {}, esFavorito = () => false, toggleFavorito = () => {},
}) {
  if (!departamento) {
    return (
      <aside className="hidden xl:block xl:w-[400px] border-l bg-white p-6 overflow-y-auto dark:border-slate-700 dark:bg-slate-900">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-5 dark:border-emerald-900 dark:from-slate-800 dark:to-slate-800/60">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-400">Exploración territorial</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-white">Selecciona un departamento</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Pasa el mouse para revisar indicadores rápidos. Haz click para abrir el detalle territorial, distritos priorizados y organizaciones inscritas.
          </p>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-600 dark:text-slate-300">
          <InfoStep number="1" title="Mapa coroplético" text="El color representa el riesgo departamental calculado con anemia promedio y cobertura de comedores." />
          <InfoStep number="2" title="Ranking distrital" text="Los distritos se reclasifican por porcentaje de anemia: bajo, medio, alto y muy alto." />
          <InfoStep number="3" title="Apoya directo" text="Las organizaciones inscritas y los comedores ENDES aparecen con opción de donar en un par de clicks." />
        </div>
      </aside>
    );
  }

  const orgs = [...(departamento.organizaciones || [])]
    .sort((a, b) => (b.nivel_necesidad || 0) - (a.nivel_necesidad || 0));
  const prioritized = departamento.distritos_priorizados || departamento.distritos_criticos || [];
  const comedores = departamento.comedores || [];
  const orgTop = orgs[0] || null;
  const favorito = esFavorito(departamento.code);

  return (
    // En pantallas chicas el detalle se superpone al mapa (overlay);
    // en desktop es una columna fija que deja el mapa protagonista.
    // key por departamento => la animación de entrada se repite al
    // cambiar de territorio.
    <aside key={departamento.code}
           className="fixed inset-y-0 right-0 z-[1500] w-full max-w-[440px] animate-slide-left overflow-y-auto border-l bg-white p-5 shadow-2xl xl:static xl:z-auto xl:w-[400px] xl:max-w-none xl:shadow-none dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Departamento</div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {departamento.name}
            <button
              onClick={() => toggleFavorito(departamento.code)}
              aria-label={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
              title={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
              className={`ml-2 align-middle text-xl ${favorito ? "" : "opacity-30 grayscale hover:opacity-70"}`}
            >
              ⭐
            </button>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Código UBIGEO departamental: {departamento.code}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Cerrar detalle"
        >
          ×
        </button>
      </div>

      {/* CTA principal: siempre arriba, imposible de perder */}
      <div className="mt-4">
        {orgTop ? (
          <button
            onClick={() => onHelp(orgTop)}
            className="nm-press w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-3.5 text-left shadow-lg shadow-emerald-600/25 transition hover:from-emerald-700 hover:to-teal-600 hover:shadow-emerald-600/40"
          >
            <span className="block text-base font-extrabold text-white">💚 Apoyar ahora a {departamento.name}</span>
            <span className="block text-xs text-emerald-50">
              Irá a <b>{orgTop.nombre}</b> (necesidad N{orgTop.nivel_necesidad}/5) · {orgs.length} organización{orgs.length !== 1 ? "es" : ""} inscrita{orgs.length !== 1 ? "s" : ""}
            </span>
          </button>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Aún no hay organizaciones inscritas aquí. ¿Conoces una olla común o comedor? Invítala a registrarse.
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl p-5 text-white shadow-md" style={{ background: colorFor(departamento.nivel_riesgo) }}>
        <div className="text-sm font-semibold uppercase tracking-wide opacity-90">Riesgo departamental por anemia promedio</div>
        <div className="text-3xl font-extrabold">{riskLabel(departamento.nivel_riesgo)}</div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Anemia promedio" value={formatPercent(departamento.porcentaje_anemia)} />
        <Stat label="Distritos con data" value={formatNumber(departamento.distritos)} />
        <Stat label="Niños evaluados" value={formatNumber(departamento.total_ninos)} />
        <Stat label="Casos detectados" value={formatNumber(departamento.casos_anemia)} />
        <Stat label="Cobertura comedor" value={formatPercent(departamento.cobertura_comedor_pct)} />
        <Stat label="Comedores ENDES" value={`${formatNumber(comedores.length)} distritos`} />
      </dl>

      <Seccion titulo={`Organizaciones inscritas (${orgs.length})`} badge="para donar" defaultOpen>
        {orgs.length ? (
          <div className="space-y-3">
            {orgs.map((org) => (
              <div key={org.id}>
                <OrgCard org={org} onHelp={onHelp} meta={metasByOrg[org.id]} />
                {(org.distrito || org.provincia) && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Ubicación: {[org.distrito, org.provincia].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox text="No hay organizaciones registradas en este departamento todavía." />
        )}
      </Seccion>

      <Seccion titulo={`Comedores y ollas (ENDES) · ${comedores.length}`} badge="data oficial" defaultOpen={comedores.length > 0}>
        <p className="mb-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Distritos donde la encuesta ENDES 2024 registró hogares usuarios de comedores
          populares u ollas comunes. Es oferta social institucional, distinta de las
          organizaciones inscritas en la plataforma.
        </p>
        {comedores.length ? (
          <div className="space-y-1.5">
            {comedores.slice(0, 12).map((c) => (
              <div key={c.ubigeo} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800 dark:text-slate-100">🍲 {c.localidad || `UBIGEO ${c.ubigeo}`}</p>
                  <p className="text-slate-500 dark:text-slate-400">UBIGEO {c.ubigeo} · {c.hogares_usan_comedor} hogar{c.hogares_usan_comedor !== 1 ? "es" : ""} usuario{c.hogares_usan_comedor !== 1 ? "s" : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {c.uso_comedor_pct != null ? `${c.uso_comedor_pct}%` : "—"}
                </span>
              </div>
            ))}
            {comedores.length > 12 && (
              <p className="text-center text-[11px] text-slate-400">y {comedores.length - 12} distritos más…</p>
            )}
          </div>
        ) : (
          <EmptyBox text="ENDES no registró hogares usuarios de comedor en este departamento (o la base masiva aún no se cargó)." />
        )}
      </Seccion>

      <Seccion titulo={`Distritos priorizados (${prioritized.length})`} badge="riesgo" defaultOpen={false}>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Ordenados por riesgo recalculado, anemia y ausencia de comedor.</p>
        {prioritized.length ? (
          <div className="space-y-2">
            {prioritized.map((d) => {
              const anemiaPct = getAnemiaPct(d);
              const totalNinos = getTotalNinos(d);
              const casosAnemia = getCasosAnemia(d);
              const riskCalculado = riskFromAnemia(anemiaPct);
              const ubigeo = String(d.ubigeo || "").padStart(6, "0");
              const distritoTexto = districtName(d);
              const riesgoBase = d.nivel_riesgo_base || d.nivel_riesgo;

              return (
                <div key={ubigeo} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100">{distritoTexto}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Provincia/código: {d.provincia || "Sin dato"} · UBIGEO {ubigeo}
                      </p>
                      {getUbigeoReference(ubigeo) && distritoTexto !== getUbigeoReference(ubigeo) && (
                        <p className="mt-1 text-[11px] text-slate-400">Referencia territorial: {getUbigeoReference(ubigeo)}</p>
                      )}
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-bold text-white"
                      style={{ background: colorFor(riskCalculado) }}
                    >
                      {riskLabel(riskCalculado)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <span>Anemia: <b>{formatPercent(anemiaPct)}</b></span>
                    <span>Muestra: <b>{formatNumber(totalNinos)}</b></span>
                    <span>Casos: <b>{formatNumber(casosAnemia)}</b></span>
                    <span>{getCoberturaComedor(d) ? "Con comedor" : "Sin comedor registrado"}</span>
                  </div>

                  {riesgoBase && riesgoBase !== riskCalculado && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-700/60 dark:text-slate-400">
                      Nota: la base lo marcaba como {riskLabel(riesgoBase)}, pero el panel lo reclasifica como {riskLabel(riskCalculado)} según el porcentaje de anemia.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyBox text="No hay distritos priorizados disponibles para este departamento." />
        )}
      </Seccion>

      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-bold">Lectura para toma de decisión</p>
        <p className="mt-1">{recommendation(departamento)}</p>
      </div>
    </aside>
  );
}

function Seccion({ titulo, badge, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mt-4 rounded-2xl border border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="font-bold text-slate-800 dark:text-slate-100">{titulo}</span>
        <span className="flex items-center gap-2">
          {badge && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {badge}
            </span>
          )}
          <span className="text-slate-400">{open ? "▴" : "▾"}</span>
        </span>
      </button>
      {open && <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-700">{children}</div>}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
      {text}
    </div>
  );
}

function InfoStep({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{number}</div>
        <div>
          <p className="font-bold text-slate-800 dark:text-slate-100">{title}</p>
          <p className="mt-1 leading-5">{text}</p>
        </div>
      </div>
    </div>
  );
}
