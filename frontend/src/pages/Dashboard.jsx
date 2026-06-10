import { useEffect, useMemo, useState } from "react";
import PeruGeoMap from "../components/PeruGeoMap.jsx";
import DepartmentSidePanel from "../components/DepartmentSidePanel.jsx";
import DonateModal from "../components/DonateModal.jsx";
import DashboardControls from "../components/DashboardControls.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { getAnemiaPct, getCasosAnemia, getCoberturaComedor, getTotalNinos, riskFromAnemia } from "../utils/riskRules.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function districtLabel(d) {
  const ubigeo = String(d.ubigeo || "").padStart(6, "0");
  const raw = String(d.distrito || "").trim();
  const ref = getUbigeoReference(ubigeo);
  if (!raw || raw === ubigeo || /^\d{6}$/.test(raw)) return ref || ubigeo;
  return raw;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsv(rows) {
  const headers = [
    "ubigeo",
    "departamento",
    "provincia",
    "distrito_o_referencia",
    "total_ninos",
    "casos_anemia",
    "porcentaje_anemia",
    "riesgo_calculado",
    "tiene_cobertura_comedor",
    "cobertura_comedor_pct",
  ];

  const body = rows.map((d) => [
    d.ubigeo,
    d.departamento,
    d.provincia,
    districtLabel(d),
    getTotalNinos(d),
    getCasosAnemia(d),
    getAnemiaPct(d),
    riskFromAnemia(getAnemiaPct(d)),
    getCoberturaComedor(d) ? "si" : "no",
    d.cobertura_comedor_pct,
  ].map(csvEscape).join(";"));

  const csv = [headers.join(";"), ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "nutrimap_distritos_filtrados.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Dashboard() {
  const [distritos, setDistritos] = useState([]);
  const [sel, setSel] = useState(null);
  const [helping, setHelping] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ query: "", risk: "TODOS", onlyNoComedor: false });
  const { rol, logout } = useAuth();

  useEffect(() => {
    api.mapa()
      .then((r) => {
        setDistritos(r.data || []);
        setStatus("ok");
      })
      .catch((e) => {
        setError(e.message);
        setStatus("error");
      });
  }, []);

  const filteredDistritos = useMemo(() => {
    const q = normalize(filters.query).trim();
    return distritos.filter((d) => {
      const risk = riskFromAnemia(getAnemiaPct(d));
      if (filters.risk !== "TODOS" && risk !== filters.risk) return false;
      if (filters.onlyNoComedor && getCoberturaComedor(d)) return false;
      if (!q) return true;

      const haystack = normalize([
        d.ubigeo,
        d.departamento,
        d.provincia,
        d.distrito,
        districtLabel(d),
        getUbigeoReference(d.ubigeo),
      ].filter(Boolean).join(" "));
      return haystack.includes(q);
    });
  }, [distritos, filters]);

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b shadow-sm px-5 py-3 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">
            NutriMap <span className="text-emerald-600">·</span> Perú
          </h1>
          <p className="text-xs text-slate-500">
            Plataforma académica de priorización nutricional infantil — ENDES 2024
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-slate-600">
            Rol: <b>{rol}</b>
          </span>
          <button onClick={logout} className="rounded-xl px-3 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800">
            Salir
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {status === "ok" && (
            <DashboardControls
              distritos={filteredDistritos}
              filters={filters}
              setFilters={setFilters}
              onExport={() => downloadCsv(filteredDistritos)}
            />
          )}

          <div className="flex-1 relative overflow-hidden">
            {status === "loading" && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-slate-50">
                <div className="rounded-2xl border bg-white px-5 py-4 text-slate-600 shadow-lg">
                  Cargando indicadores nutricionales…
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-red-50">
                <div className="max-w-md rounded-2xl border border-red-200 bg-white p-5 text-red-700 shadow-lg">
                  <p className="font-bold">No se pudo cargar la data del mapa</p>
                  <p className="mt-2 text-sm">Error: {error}</p>
                </div>
              </div>
            )}
            {status === "ok" && <PeruGeoMap distritos={filteredDistritos} onSelect={setSel} />}
          </div>
        </div>

        <DepartmentSidePanel departamento={sel} onClose={() => setSel(null)} onHelp={setHelping} />
      </main>

      <DonateModal org={helping} onClose={() => setHelping(null)} />
    </div>
  );
}
