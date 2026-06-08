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
    return "Hay organizaciones inscritas. El panel permite identificar actores locales y canalizar donaciones demo hacia zonas priorizadas.";
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

export default function DepartmentSidePanel({ departamento, onClose, onHelp }) {
  if (!departamento) {
    return (
      <aside className="w-[460px] border-l bg-white p-6 overflow-y-auto">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-sky-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Exploración territorial</p>
          <h2 className="mt-2 text-2xl font-extrabold text-slate-900">Selecciona un departamento</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Pasa el mouse para revisar indicadores rápidos. Haz click para abrir el detalle territorial, distritos priorizados y organizaciones inscritas.
          </p>
        </div>

        <div className="mt-5 space-y-3 text-sm text-slate-600">
          <InfoStep number="1" title="Mapa coroplético" text="El color representa el riesgo departamental calculado con anemia promedio y cobertura de comedores." />
          <InfoStep number="2" title="Ranking distrital" text="Los distritos se reclasifican por porcentaje de anemia: bajo, medio, alto y muy alto." />
          <InfoStep number="3" title="Acción demo" text="Las organizaciones inscritas aparecen con opción de ayuda mediante donación simulada." />
        </div>
      </aside>
    );
  }

  const orgs = departamento.organizaciones || [];
  const prioritized = departamento.distritos_priorizados || departamento.distritos_criticos || [];

  return (
    <aside className="w-[460px] border-l bg-white p-5 overflow-y-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Departamento</div>
          <h2 className="text-3xl font-extrabold text-slate-900">{departamento.name}</h2>
          <p className="text-xs text-slate-500">Código UBIGEO departamental: {departamento.code}</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full px-2 py-1 text-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Cerrar detalle"
        >
          ×
        </button>
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
        <Stat label="Organizaciones" value={formatNumber(orgs.length)} />
      </dl>

      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        <p className="font-bold">Lectura para toma de decisión</p>
        <p className="mt-1">{recommendation(departamento)}</p>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-800">Distritos priorizados</h3>
            <p className="text-xs text-slate-500">Ordenados por riesgo recalculado, anemia y ausencia de comedor.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">Top {prioritized.length}</span>
        </div>

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
                <div key={ubigeo} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">{distritoTexto}</p>
                      <p className="text-xs text-slate-500">
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

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <span>Anemia: <b>{formatPercent(anemiaPct)}</b></span>
                    <span>Muestra: <b>{formatNumber(totalNinos)}</b></span>
                    <span>Casos: <b>{formatNumber(casosAnemia)}</b></span>
                    <span>{getCoberturaComedor(d) ? "Con comedor" : "Sin comedor registrado"}</span>
                  </div>

                  {riesgoBase && riesgoBase !== riskCalculado && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
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
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Organizaciones inscritas</h3>
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{orgs.length}</span>
        </div>
        {orgs.length ? (
          <div className="space-y-3">
            {orgs.map((org) => (
              <div key={org.id}>
                <OrgCard org={org} onHelp={onHelp} />
                {(org.distrito || org.provincia) && (
                  <p className="mt-1 text-xs text-slate-500">
                    Ubicación: {[org.distrito, org.provincia].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox text="No hay organizaciones registradas en este departamento todavía." />
        )}
      </section>
    </aside>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function EmptyBox({ text }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-6 text-slate-500">
      {text}
    </div>
  );
}

function InfoStep({ number, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 p-4">
      <div className="flex gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{number}</div>
        <div>
          <p className="font-bold text-slate-800">{title}</p>
          <p className="mt-1 leading-5">{text}</p>
        </div>
      </div>
    </div>
  );
}
