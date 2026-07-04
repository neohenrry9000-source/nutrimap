// Panel privado de administración: resumen del sistema y flujo de
// aprobación de retiros. La ruta solo se monta con rol admin, pero la
// garantía real está en el backend (require_role("admin") en cada
// endpoint): un usuario que fuerce la URL solo verá errores 403.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";

const ESTADOS_RETIRO = ["", "pendiente", "observado", "aprobado", "completado", "rechazado"];

const BADGE = {
  pendiente:  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  observado:  "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  aprobado:   "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  rechazado:  "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
};

// Qué acciones ofrece la UI según el estado actual (espejo del backend)
const ACCIONES = {
  pendiente: ["aprobar", "observar", "rechazar"],
  observado: ["aprobar", "rechazar"],
  aprobado:  ["completar", "observar", "rechazar"],
};

const ACCION_UI = {
  aprobar:   { label: "✅ Aprobar",   cls: "bg-sky-600 hover:bg-sky-700" },
  observar:  { label: "👁️ Observar",  cls: "bg-orange-500 hover:bg-orange-600" },
  rechazar:  { label: "✕ Rechazar",   cls: "bg-red-600 hover:bg-red-700" },
  completar: { label: "🏁 Completar", cls: "bg-emerald-600 hover:bg-emerald-700" },
};

function fecha(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fmt(v, m = "PEN") {
  return `${m === "USD" ? "$" : "S/"} ${Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

function fmtTotales(tot = {}) {
  const partes = Object.entries(tot).map(([m, v]) => fmt(v, m));
  return partes.length ? partes.join(" · ") : "S/ 0.00";
}

export default function Admin() {
  const { logout } = useAuth();
  const nav = useNavigate();
  const [resumen, setResumen] = useState(null);
  const [retiros, setRetiros] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [detalle, setDetalle] = useState(null); // retiro seleccionado
  const [err, setErr] = useState("");

  const cargar = useCallback(() => {
    api.adminResumen().then((r) => setResumen(r.data)).catch((e) => {
      if (e.status === 401 || e.status === 403) { nav("/"); return; }
      setErr(e.message);
    });
    api.adminRetiros(filtro).then((r) => setRetiros(r.data)).catch(() => setRetiros([]));
  }, [filtro, nav]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              ← Mapa
            </Link>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              🛡️ Administración <span className="text-emerald-600">·</span> NutriMap
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ThemeToggle />
            <button onClick={() => { logout(); nav("/login"); }}
                    className="rounded-xl px-3 py-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700">
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        {err && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{err}</div>}

        {/* ------- Resumen del sistema ------- */}
        <section className="animate-fade-up rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Resumen del sistema</h2>
          {!resumen ? (
            <div className="nm-skeleton mt-3 h-16 animate-shimmer rounded-xl" />
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Total donado" value={fmtTotales(resumen.total_donado)} tone="text-emerald-600 dark:text-emerald-400" />
              <Kpi label="Total retirado" value={fmtTotales(resumen.total_retirado)} tone="text-slate-700 dark:text-slate-200" />
              <Kpi label="Retiros por revisar" value={resumen.retiros_pendientes} tone="text-amber-600 dark:text-amber-400" destacado={resumen.retiros_pendientes > 0} />
              <Kpi label="Donaciones ingresadas" value={resumen.donaciones_ingresadas} tone="text-slate-700 dark:text-slate-200" />
              <Kpi label="Organizaciones" value={`${resumen.organizaciones_activas}/${resumen.organizaciones}`} tone="text-slate-700 dark:text-slate-200" />
              <Kpi label="Donadores" value={resumen.donadores} tone="text-slate-700 dark:text-slate-200" />
            </div>
          )}

          {resumen?.actividad?.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Actividad reciente</h3>
              <div className="mt-2 grid gap-1.5 md:grid-cols-2">
                {resumen.actividad.slice(0, 6).map((a) => (
                  <div key={a.id} className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-700/60">
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{a.titulo}</p>
                    <p className="text-slate-500 dark:text-slate-400">{a.mensaje || ""} · {fecha(a.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ------- Retiros ------- */}
        <section className="animate-fade-up rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Solicitudes de retiro</h2>
            <div className="flex flex-wrap gap-1.5">
              {ESTADOS_RETIRO.map((e) => (
                <button key={e || "todos"} onClick={() => setFiltro(e)}
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                          filtro === e
                            ? "bg-slate-900 text-white dark:bg-emerald-600"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"}`}>
                  {e || "todos"}
                </button>
              ))}
            </div>
          </div>

          {retiros === null ? (
            <div className="nm-skeleton mt-3 h-24 animate-shimmer rounded-xl" />
          ) : retiros.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-3">Solicitado</th>
                    <th className="py-2 pr-3">Organización</th>
                    <th className="py-2 pr-3">Monto</th>
                    <th className="py-2 pr-3">Disponible org.</th>
                    <th className="py-2 pr-3">Estado</th>
                    <th className="py-2 pr-3">Cobro</th>
                    <th className="py-2">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {retiros.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{fecha(r.fecha_solicitud)}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{r.organizacion?.nombre}</p>
                        <p className="text-xs text-slate-400">{r.organizacion?.departamento}</p>
                      </td>
                      <td className="py-2.5 pr-3 font-bold text-slate-900 dark:text-white">{fmt(r.monto, r.moneda)}</td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{fmt(r.disponible_org, r.moneda)}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${BADGE[r.estado] || ""}`}>{r.estado}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400">
                        {r.metodos_cobro?.length
                          ? (r.metodos_cobro[0].tipo === "yape"
                              ? `📱 Yape ${r.metodos_cobro[0].yape_numero}`
                              : `🏦 ${r.metodos_cobro[0].banco}`)
                          : <span className="text-red-400">Sin método ⚠️</span>}
                      </td>
                      <td className="py-2.5">
                        <button onClick={() => setDetalle(r)}
                                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No hay solicitudes {filtro ? `en estado "${filtro}"` : "registradas"} por ahora.
            </p>
          )}
        </section>

        <Moderacion />
      </main>

      {detalle && (
        <DetalleRetiro
          retiro={detalle}
          onClose={() => setDetalle(null)}
          onDone={() => { setDetalle(null); cargar(); }}
        />
      )}
    </div>
  );
}

/* ------------------------------ Moderación ------------------------------ */

const ESTADO_MOD_BADGE = {
  activo:     "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  suspendido: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  baneado:    "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
};

const ACCIONES_MOD = {
  activo:     ["suspender", "banear"],
  suspendido: ["reactivar", "banear"],
  baneado:    ["reactivar"],
};

const ACCION_MOD_UI = {
  suspender: { label: "⏸️ Suspender", cls: "bg-amber-500 hover:bg-amber-600" },
  banear:    { label: "🚫 Banear",    cls: "bg-red-600 hover:bg-red-700" },
  reactivar: { label: "✅ Reactivar", cls: "bg-emerald-600 hover:bg-emerald-700" },
};

function Moderacion() {
  const [tab, setTab] = useState("organizacion"); // organizacion | usuario
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [rows, setRows] = useState(null);
  const [moderando, setModerando] = useState(null); // entidad seleccionada
  const [historial, setHistorial] = useState(null); // {entidad, eventos}

  const cargar = useCallback(() => {
    const params = {};
    if (q.trim()) params.q = q.trim();
    if (estado) params.estado = estado;
    const fn = tab === "usuario" ? api.adminUsuarios : api.adminOrganizaciones;
    if (tab === "usuario") params.rol = "donador";
    fn(params).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [tab, q, estado]);

  useEffect(() => { cargar(); }, [cargar]);

  const verHistorial = async (ent) => {
    try {
      const r = await api.adminHistorialModeracion(tab, ent.id);
      setHistorial({ entidad: ent, eventos: r.data });
    } catch { setHistorial({ entidad: ent, eventos: [] }); }
  };

  return (
    <section className="animate-fade-up rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">🧑‍⚖️ Moderación</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Suspende (temporal) o banea (fuerte) cuentas por fraude o abuso. Nada se borra: todo queda trazado.
          </p>
        </div>
        <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700">
          {[["organizacion", "Organizaciones"], ["usuario", "Donadores"]].map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setRows(null); }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      tab === t ? "bg-white shadow text-slate-800 dark:bg-slate-600 dark:text-white"
                                : "text-slate-500 dark:text-slate-400"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={tab === "usuario" ? "Buscar por email o nombre…" : "Buscar por nombre, email del dueño o RUC…"}
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        {["", "activo", "suspendido", "baneado"].map((e) => (
          <button key={e || "todos"} onClick={() => setEstado(e)}
                  className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                    estado === e ? "bg-slate-900 text-white dark:bg-emerald-600"
                                 : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"}`}>
            {e || "todos"}
          </button>
        ))}
      </div>

      {rows === null ? (
        <div className="nm-skeleton mt-3 h-20 animate-shimmer rounded-xl" />
      ) : rows.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-3">{tab === "usuario" ? "Donador" : "Organización"}</th>
                <th className="py-2 pr-3">{tab === "usuario" ? "Registro" : "Dueño"}</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2.5 pr-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">
                      {tab === "usuario" ? (r.nombre || "(sin nombre)") : r.nombre}
                    </p>
                    <p className="text-xs text-slate-400">
                      {tab === "usuario" ? r.email : `${r.departamento || ""} · ${r.tipo || ""}${r.ruc ? ` · RUC ${r.ruc}` : ""}`}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-slate-500 dark:text-slate-400">
                    {tab === "usuario" ? fecha(r.created_at) : (r.dueno_email || "—")}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${ESTADO_MOD_BADGE[r.estado] || ""}`}>{r.estado}</span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(ACCIONES_MOD[r.estado] || []).map((a) => (
                        <button key={a} onClick={() => setModerando({ ...r, accion: a })}
                                className={`nm-press rounded-lg px-2.5 py-1 text-[11px] font-bold text-white ${ACCION_MOD_UI[a].cls}`}>
                          {ACCION_MOD_UI[a].label}
                        </button>
                      ))}
                      <button onClick={() => verHistorial(r)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700">
                        📋 Historial
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Sin resultados con esos filtros.</p>
      )}

      {moderando && (
        <ModalModerar
          entidad={moderando} tipo={tab}
          onClose={() => setModerando(null)}
          onDone={() => { setModerando(null); cargar(); }}
        />
      )}
      {historial && (
        <ModalHistorial data={historial} onClose={() => setHistorial(null)} />
      )}
    </section>
  );
}

function ModalModerar({ entidad, tipo, onClose, onDone }) {
  const [motivo, setMotivo] = useState("");
  const [state, setState] = useState({ enviando: false, err: "" });
  const ui = ACCION_MOD_UI[entidad.accion];

  const ejecutar = async () => {
    if (motivo.trim().length < 5 || state.enviando) return;
    setState({ enviando: true, err: "" });
    try {
      await api.adminModerar({ tipo, id: entidad.id, accion: entidad.accion, motivo: motivo.trim() });
      onDone();
    } catch (err) {
      setState({ enviando: false, err: err.detail || err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex animate-overlay-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
          {ui.label} · {entidad.nombre || entidad.email}
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {entidad.accion === "banear" && "Bloqueo fuerte: no podrá iniciar sesión / desaparece del mapa y no recibe donaciones."}
          {entidad.accion === "suspender" && "Restricción temporal: podrá ver su historial pero no operar (donar, editar, retirar)."}
          {entidad.accion === "reactivar" && "La cuenta/organización vuelve a operar con normalidad."}
        </p>
        <label className="mt-3 block">
          <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Motivo (obligatorio, queda en el historial)</span>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500}
                    placeholder="Ej. múltiples reportes de donaciones fraudulentas verificados el 04/07"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
        </label>
        {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          <button onClick={ejecutar} disabled={motivo.trim().length < 5 || state.enviando}
                  className={`nm-press rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40 ${ui.cls}`}>
            {state.enviando ? "…" : ui.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalHistorial({ data, onClose }) {
  const { entidad, eventos } = data;
  return (
    <div className="fixed inset-0 z-[2000] flex animate-overlay-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[75vh] w-full max-w-md animate-scale-in overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
            📋 Historial · {entidad.nombre || entidad.email}
          </h3>
          <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">×</button>
        </div>
        {eventos.length ? (
          <ol className="mt-3 space-y-2">
            {eventos.map((e) => (
              <li key={e.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-700/50">
                <div className="flex items-center justify-between">
                  <span className="font-bold capitalize text-slate-800 dark:text-slate-100">{e.accion}</span>
                  <span className="text-xs text-slate-400">{fecha(e.created_at)}</span>
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{e.motivo}</p>
                {e.estado_previo && <p className="mt-0.5 text-[11px] text-slate-400">Estado previo: {e.estado_previo}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-400">Sin acciones de moderación registradas.</p>
        )}
      </div>
    </div>
  );
}

function DetalleRetiro({ retiro, onClose, onDone }) {
  const [nota, setNota] = useState(retiro.nota_admin || "");
  const [state, setState] = useState({ enviando: "", err: "" });
  const acciones = ACCIONES[retiro.estado] || [];

  const ejecutar = async (accion) => {
    if (state.enviando) return;
    setState({ enviando: accion, err: "" });
    try {
      await api.adminAccionRetiro(retiro.id, { accion, nota: nota.trim() });
      onDone();
    } catch (err) {
      setState({ enviando: "", err: err.detail || err.message });
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex animate-overlay-in items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg animate-scale-in overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Retiro · {fmt(retiro.monto, retiro.moneda)}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {retiro.organizacion?.nombre} · {retiro.organizacion?.departamento}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${BADGE[retiro.estado] || ""}`}>{retiro.estado}</span>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <Dato k="Solicitado" v={fecha(retiro.fecha_solicitud)} />
          <Dato k="Procesado" v={retiro.fecha_procesamiento ? fecha(retiro.fecha_procesamiento) : "—"} />
          <Dato k="Disponible de la org." v={fmt(retiro.disponible_org, retiro.moneda)} />
          <Dato k="Contacto" v={retiro.organizacion?.email_contacto || retiro.organizacion?.telefono || "—"} />
        </dl>

        {retiro.nota && (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-700/60">
            <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Nota de la organización</p>
            <p className="mt-1 text-slate-700 dark:text-slate-200">{retiro.nota}</p>
          </div>
        )}

        <div className="mt-3">
          <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Destino del retiro</p>
          {retiro.metodos_cobro?.length ? (
            <div className="mt-1.5 space-y-2">
              {retiro.metodos_cobro.map((m) => (
                <div key={m.id} className={`rounded-xl border p-3 text-sm ${m.principal
                  ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40"
                  : "border-slate-200 dark:border-slate-600"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-100">
                      {m.tipo === "yape" ? "📱 Yape" : `🏦 ${m.banco}`}
                    </span>
                    {m.principal && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">PRINCIPAL</span>}
                  </div>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">
                    Titular: <b>{m.titular}</b>
                    {m.tipo === "yape"
                      ? <> · Nº <span className="font-mono">{m.yape_numero}</span></>
                      : <> · Cta <span className="font-mono">{m.numero_cuenta}</span> ({m.tipo_cuenta || "—"}){m.cci && <> · CCI <span className="font-mono">{m.cci}</span></>}</>}
                  </p>
                  {m.observaciones && <p className="mt-1 text-xs text-slate-400">{m.observaciones}</p>}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 rounded-xl border border-dashed border-red-300 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
              ⚠️ La organización aún no registró métodos de cobro. Conviene observar el retiro pidiendo que los configure.
            </p>
          )}
        </div>

        {retiro.nota_admin && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
            <p className="text-xs font-bold uppercase text-amber-700 dark:text-amber-300">Nota administrativa previa</p>
            <p className="mt-1 text-amber-900 dark:text-amber-200">{retiro.nota_admin}</p>
          </div>
        )}

        {acciones.length > 0 && (
          <>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Nota / observación (queda registrada)</span>
              <textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={500} rows={2}
                        placeholder="Ej. transferencia programada para el viernes"
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />
            </label>
            {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {acciones.map((a) => (
                <button key={a} onClick={() => ejecutar(a)} disabled={!!state.enviando}
                        className={`rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50 ${ACCION_UI[a].cls}`}>
                  {state.enviando === a ? "…" : ACCION_UI[a].label}
                </button>
              ))}
            </div>
          </>
        )}
        {!acciones.length && (
          <p className="mt-4 text-center text-sm text-slate-400">
            Estado final: este retiro ya no admite acciones.
          </p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone, destacado }) {
  return (
    <div className={`rounded-xl border p-3 ${destacado
      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
      : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

function Dato({ k, v }) {
  return (
    <div className="rounded-xl bg-slate-50 p-2.5 dark:bg-slate-700/60">
      <p className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{k}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">{v}</p>
    </div>
  );
}
