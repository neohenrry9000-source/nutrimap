import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PeruGeoMap from "../components/PeruGeoMap.jsx";
import DepartmentSidePanel from "../components/DepartmentSidePanel.jsx";
import DonateModal from "../components/DonateModal.jsx";
import DashboardControls from "../components/DashboardControls.jsx";
import DashboardGuide from "../components/DashboardGuide.jsx";
import DonationFeed from "../components/DonationFeed.jsx";
import EmptyState from "../components/EmptyState.jsx";
import OnboardingTips from "../components/OnboardingTips.jsx";
import RankingModal from "../components/RankingModal.jsx";
import StatsStrip from "../components/StatsStrip.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useFavoritos } from "../hooks/useFavoritos.js";
import { getAnemiaPct, getCasosAnemia, getCoberturaComedor, getTotalNinos, riskFromAnemia } from "../utils/riskRules.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
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
    "ubigeo", "departamento", "provincia", "distrito_o_referencia",
    "total_ninos", "casos_anemia", "porcentaje_anemia", "riesgo_calculado",
    "tiene_cobertura_comedor", "cobertura_comedor_pct",
    "comedor_endes_localidad", "comedor_endes_hogares",
  ];

  const body = rows.map((d) => [
    d.ubigeo, d.departamento, d.provincia, districtLabel(d),
    getTotalNinos(d), getCasosAnemia(d), getAnemiaPct(d),
    riskFromAnemia(getAnemiaPct(d)),
    getCoberturaComedor(d) ? "si" : "no",
    d.cobertura_comedor_pct,
    d.oferta_social?.localidad || "",
    d.oferta_social?.hogares_usan_comedor ?? "",
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
  const [ranking, setRanking] = useState(false);
  const [presentacion, setPresentacion] = useState(false);
  const [metasByOrg, setMetasByOrg] = useState({});
  const { rol, logout } = useAuth();
  const { favoritos, toggleFavorito, esFavorito } = useFavoritos();

  // Filtros sincronizados con la URL: la vista es compartible/guardable.
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    query: searchParams.get("q") || "",
    risk: searchParams.get("riesgo") || "TODOS",
    onlyNoComedor: searchParams.get("sincomedor") === "1",
    onlyFavoritos: searchParams.get("fav") === "1",
  }));

  useEffect(() => {
    const p = {};
    if (filters.query) p.q = filters.query;
    if (filters.risk !== "TODOS") p.riesgo = filters.risk;
    if (filters.onlyNoComedor) p.sincomedor = "1";
    if (filters.onlyFavoritos) p.fav = "1";
    setSearchParams(p, { replace: true });
  }, [filters, setSearchParams]);

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
    api.metas().then((r) => {
      const porOrg = {};
      (r.data || []).forEach((m) => {
        if (m.tipo === "organizacion" && m.id_organizacion) porOrg[m.id_organizacion] = m;
      });
      setMetasByOrg(porOrg);
    }).catch(() => {});
  }, []);

  // Atajos: "/" enfoca la búsqueda, ESC sale del modo presentación.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
        document.getElementById("nm-search")?.focus();
      }
      if (e.key === "Escape") setPresentacion(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredDistritos = useMemo(() => {
    const q = normalize(filters.query).trim();
    return distritos.filter((d) => {
      const risk = riskFromAnemia(getAnemiaPct(d));
      if (filters.risk !== "TODOS" && risk !== filters.risk) return false;
      if (filters.onlyNoComedor && getCoberturaComedor(d)) return false;
      if (filters.onlyFavoritos &&
          !favoritos.includes(String(d.ubigeo || "").padStart(6, "0").slice(0, 2))) return false;
      if (!q) return true;

      const haystack = normalize([
        d.ubigeo,
        d.departamento,
        d.provincia,
        d.distrito,
        districtLabel(d),
        getUbigeoReference(d.ubigeo),
        d.oferta_social?.localidad,
      ].filter(Boolean).join(" "));
      return haystack.includes(q);
    });
  }, [distritos, filters, favoritos]);

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      {!presentacion && (
        <header className="bg-white dark:bg-slate-800 border-b dark:border-slate-700 shadow-sm px-4 py-2 flex justify-between items-center">
          <div className="flex items-baseline gap-3 min-w-0">
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white shrink-0">
              NutriMap <span className="text-emerald-600">·</span> Perú
            </h1>
            <p className="hidden md:block truncate text-xs text-slate-500 dark:text-slate-400">
              Priorización nutricional infantil — ENDES 2024
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm shrink-0">
            <button
              onClick={() => setRanking(true)}
              className="hidden sm:inline rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              🏆 Ranking
            </button>
            <button
              onClick={() => setPresentacion(true)}
              title="Modo presentación (ESC para salir)"
              className="hidden sm:inline rounded-xl border border-slate-200 px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              🖥️
            </button>
            <ThemeToggle />
            {rol === "admin" && (
              <Link
                to="/admin"
                className="rounded-xl bg-slate-900 px-3 py-1.5 font-semibold text-white hover:bg-slate-700 dark:bg-slate-600 dark:hover:bg-slate-500"
              >
                🛡️ Admin
              </Link>
            )}
            <Link
              to="/panel"
              className="rounded-xl bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
            >
              Mi panel
            </Link>
            <span className="hidden lg:inline rounded-xl bg-slate-100 px-3 py-1.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Rol: <b>{rol}</b>
            </span>
            <button onClick={logout} className="rounded-xl px-3 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200">
              Salir
            </button>
          </div>
        </header>
      )}

      {!presentacion && <StatsStrip />}
      {!presentacion && <DashboardGuide />}

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          {status === "ok" && !presentacion && (
            <DashboardControls
              distritos={filteredDistritos}
              filters={filters}
              setFilters={setFilters}
              onExport={() => downloadCsv(filteredDistritos)}
              hayFavoritos={favoritos.length > 0}
            />
          )}

          <div className="flex-1 relative overflow-hidden">
            {presentacion && (
              <button
                onClick={() => setPresentacion(false)}
                className="absolute right-4 top-4 z-[900] rounded-xl bg-slate-900/80 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-slate-900"
              >
                ✕ Salir de presentación (ESC)
              </button>
            )}
            {status === "loading" && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-slate-50 dark:bg-slate-900">
                <div className="w-72 rounded-2xl border bg-white p-5 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <p className="font-semibold text-slate-600 dark:text-slate-300">Cargando indicadores nutricionales…</p>
                  <div className="nm-skeleton mt-4 h-3 w-full animate-shimmer rounded-full" />
                  <div className="nm-skeleton mt-2 h-3 w-4/5 animate-shimmer rounded-full" />
                  <div className="nm-skeleton mt-2 h-3 w-3/5 animate-shimmer rounded-full" />
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-red-50 dark:bg-slate-900">
                <div className="max-w-md rounded-2xl border border-red-200 bg-white p-5 text-red-700 shadow-lg dark:border-red-900 dark:bg-slate-800 dark:text-red-400">
                  <p className="font-bold">No se pudo cargar la data del mapa</p>
                  <p className="mt-2 text-sm">Error: {error}</p>
                </div>
              </div>
            )}
            {status === "ok" && filteredDistritos.length === 0 && (
              <div className="absolute inset-0 z-20 grid place-items-center bg-slate-50/95 p-6 dark:bg-slate-900/95">
                <EmptyState
                  title="No hay distritos con esos filtros"
                  message="Cambia el nivel de riesgo, limpia la búsqueda o desactiva los filtros de comedor/favoritos."
                />
              </div>
            )}

            {status === "ok" && filteredDistritos.length > 0 && (
              <PeruGeoMap distritos={filteredDistritos} onSelect={setSel} />
            )}
          </div>
        </div>

        {!presentacion && (
          <DepartmentSidePanel
            departamento={sel}
            onClose={() => setSel(null)}
            onHelp={setHelping}
            metasByOrg={metasByOrg}
            esFavorito={esFavorito}
            toggleFavorito={toggleFavorito}
          />
        )}
      </main>

      <DonateModal org={helping} onClose={() => setHelping(null)} />
      {ranking && (
        <RankingModal
          distritos={distritos}
          favoritos={favoritos}
          toggleFavorito={toggleFavorito}
          onClose={() => setRanking(false)}
        />
      )}
      {!presentacion && <DonationFeed />}
      <OnboardingTips />
    </div>
  );
}
