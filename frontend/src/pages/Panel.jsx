import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import AvatarUploader from "../components/AvatarUploader.jsx";
import DonorBadge from "../components/DonorBadge.jsx";
import EmptyState from "../components/EmptyState.jsx";
import GoalBar from "../components/GoalBar.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import {
  DEPARTAMENTOS,
  departamentoName,
  localidadesDeDepartamento,
} from "../utils/departamentos.js";
import { getUbigeoReference } from "../utils/ubigeoReferencial.js";

const TIPOS_ORG = [
  { value: "olla_comun", label: "Olla común" },
  { value: "comedor_popular", label: "Comedor popular" },
  { value: "otro", label: "Otro" },
];

const ESTADO_BADGE = {
  completada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  confirmada: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  pendiente:  "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300",
  observada:  "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  fallida:    "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  rechazada:  "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
  // retiros
  aprobado:   "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
  observado:  "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300",
  completado: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300",
  rechazado:  "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300",
};

const METODO_ICON = { tarjeta: "💳", yape: "📱" };

const inputCls = "mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";
const labelCls = "text-xs font-semibold uppercase text-slate-500 dark:text-slate-400";
const cardCls  = "animate-fade-up rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800";

function fechaCorta(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function monto(r) {
  return `${r.moneda === "USD" ? "$" : "S/"} ${Number(r.monto).toFixed(2)}`;
}

function fmt(v, moneda = "PEN") {
  return `${moneda === "USD" ? "$" : "S/"} ${Number(v || 0).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;
}

function ubigeoLabel(ubigeo) {
  if (!ubigeo) return "";
  const ref = getUbigeoReference(ubigeo);
  const dep = departamentoName(String(ubigeo).slice(0, 2));
  return [ref, dep].filter(Boolean).join(", ") || `UBIGEO ${ubigeo}`;
}

export default function Panel() {
  const { rol, logout } = useAuth();
  const nav = useNavigate();
  const [perfil, setPerfil] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    api.me()
      .then((r) => { setPerfil(r.data); setStatus("ok"); })
      .catch((e) => {
        if (e.status === 401) { logout(); nav("/login"); return; }
        setStatus("error");
      });
  }, [logout, nav]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-20 border-b bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-800/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              ← Volver al mapa
            </Link>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Mi panel <span className="text-emerald-600">·</span> NutriMap
            </h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <ThemeToggle />
            <span className="hidden rounded-xl bg-slate-100 px-3 py-1.5 text-slate-600 sm:inline dark:bg-slate-700 dark:text-slate-300">
              Rol: <b>{rol}</b>
            </span>
            <button
              onClick={() => { logout(); nav("/login"); }}
              className="rounded-xl px-3 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-5">
        {status === "loading" && <LoadingBox text="Cargando tu panel…" />}
        {status === "error" && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            No se pudo cargar tu perfil. Intenta recargar la página.
          </div>
        )}
        {status === "ok" && perfil && (
          <>
            {perfil.estado && perfil.estado !== "activo" && (
              <div className="animate-fade-up rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                <p className="font-bold">
                  {perfil.estado === "suspendido" ? "⏸️ Tu cuenta está suspendida temporalmente" : "🚫 Tu cuenta está bloqueada"}
                </p>
                <p className="mt-1">
                  Puedes ver tu información e historial, pero las acciones (donar, editar, retirar) están deshabilitadas.
                  Si crees que es un error, contacta al administrador.
                </p>
              </div>
            )}
            <PerfilCard perfil={perfil} onSaved={(nombre) => setPerfil((p) => ({ ...p, nombre }))} />
            {perfil.rol === "organizacion" || perfil.rol === "admin" ? <OrgSection /> : <DonorSection />}
          </>
        )}
      </main>
    </div>
  );
}

/* ---------------- Perfil (común a ambos roles) ---------------- */

function PerfilCard({ perfil, onSaved }) {
  const [nombre, setNombre] = useState(perfil.nombre || "");
  const [avatar, setAvatar] = useState(perfil.avatar_url || null);
  const [state, setState] = useState({ saving: false, msg: "", err: "" });
  const dirty = nombre.trim() !== (perfil.nombre || "");

  const save = async (e) => {
    e.preventDefault();
    if (!nombre.trim() || state.saving) return;
    setState({ saving: true, msg: "", err: "" });
    try {
      await api.updPerfil({ nombre: nombre.trim() });
      onSaved(nombre.trim());
      setState({ saving: false, msg: "Perfil actualizado.", err: "" });
    } catch (err) {
      setState({ saving: false, msg: "", err: err.detail || err.message });
    }
  };

  const subirFoto = async (body) => {
    const r = await api.subirAvatar(body);
    setAvatar(r.avatar_url);
  };

  return (
    <section className={cardCls}>
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Mi perfil</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <AvatarUploader src={avatar} nombre={perfil.nombre || perfil.email} onUpload={subirFoto} />
        <form onSubmit={save} className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className={labelCls}>Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)}
                   maxLength={120} required className={inputCls} />
          </label>
          <div>
            <span className={labelCls}>Email (no editable)</span>
            <p className="mt-1 truncate rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-700 dark:text-slate-300">{perfil.email}</p>
          </div>
          <div className="flex items-end">
            <button type="submit" disabled={!dirty || state.saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-600">
              {state.saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
      {state.msg && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{state.msg}</p>}
      {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
    </section>
  );
}

/* ---------------- Donador ---------------- */

function DonorSection() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.misDonaciones().then(setData).catch((e) => setErr(e.message));
  }, []);

  if (err) return <ErrorBox text={`No se pudo cargar tu historial: ${err}`} />;
  if (!data) return <LoadingBox text="Cargando tus donaciones…" />;

  const { data: rows, resumen, nivel } = data;

  return (
    <>
    {nivel && <NivelCard nivel={nivel} />}
    <section className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Mis donaciones</h2>
        <Link to="/" className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Explorar el mapa para donar →
        </Link>
      </div>

      <ResumenDonaciones resumen={resumen} etiquetaTotal="Total donado" />

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Organización</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Método</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Visibilidad</th>
                <th className="py-2">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{fechaCorta(r.fecha)}</td>
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{r.organizacion}</p>
                    <p className="text-xs text-slate-400">{ubigeoLabel(r.organizacion_ubigeo)}</p>
                  </td>
                  <td className="py-2 pr-3 font-bold text-slate-900 dark:text-white">{monto(r)}</td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                    {METODO_ICON[r.metodo_pago] || "💳"} {r.metodo_pago || "tarjeta"}
                  </td>
                  <td className="py-2 pr-3"><EstadoBadge estado={r.estado} /></td>
                  <td className="py-2 pr-3 text-xs">
                    {r.es_anonima
                      ? <span title="Tu nombre no se muestra públicamente">🕶️ Anónima</span>
                      : <span className="text-slate-400">Pública</span>}
                  </td>
                  <td className="py-2 font-mono text-xs text-slate-400">{(r.referencia_pago || "").slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Aún no has donado"
            message="Explora el mapa, elige un departamento y apoya a una organización inscrita — con tarjeta o Yape, incluso de forma anónima."
          />
        </div>
      )}
    </section>
    </>
  );
}

function NivelCard({ nivel }) {
  return (
    <section className={`${cardCls} overflow-hidden`}>
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <DonorBadge clave={nivel.clave} nombre={nivel.nombre} />
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Tu nivel de donador</p>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
            Nivel {nivel.nombre}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Has aportado <b>S/ {Number(nivel.total_pen).toLocaleString("es-PE")}</b> en{" "}
            <b>{nivel.donaciones_ingresadas}</b> donación{nivel.donaciones_ingresadas !== 1 ? "es" : ""} ingresada{nivel.donaciones_ingresadas !== 1 ? "s" : ""}. 💚
          </p>
          {nivel.siguiente ? (
            <div className="mt-2">
              <GoalBar
                compact
                titulo={`Camino a ${nivel.siguiente.nombre}`}
                recaudado={nivel.total_pen}
                objetivo={nivel.siguiente.umbral_pen}
                moneda="PEN"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Te faltan <b>S/ {Number(nivel.siguiente.falta_pen).toLocaleString("es-PE")}</b> para ser {nivel.siguiente.nombre}.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-bold text-sky-600 dark:text-sky-400">
              💎 ¡Nivel máximo alcanzado! Gracias por tu apoyo extraordinario.
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-slate-400">
            Tu nivel es privado: solo tú lo ves. Las donaciones anónimas también suman.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ---------------- Organización ---------------- */

function OrgSection() {
  const [org, setOrg] = useState(undefined); // undefined = cargando, null = sin org
  const [err, setErr] = useState("");

  useEffect(() => {
    api.miOrg().then((r) => setOrg(r.data)).catch((e) => setErr(e.message));
  }, []);

  if (err) return <ErrorBox text={`No se pudo cargar tu organización: ${err}`} />;
  if (org === undefined) return <LoadingBox text="Cargando tu organización…" />;

  return (
    <>
      {org && <FinanzasSection />}
      <OrgForm org={org} onSaved={setOrg} />
      {org && <MetodosCobroSection />}
      {org && <OrgDonaciones />}
    </>
  );
}

/* ---- Dashboard financiero: saldos, meta y retiros ---- */

function FinanzasSection() {
  const [fin, setFin] = useState(null);
  const [retiros, setRetiros] = useState(null);
  const [err, setErr] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    api.finanzas().then(setFin).catch((e) => setErr(e.message));
    api.retiros().then((r) => setRetiros(r.data)).catch(() => setRetiros([]));
  }, [refresh]);

  const recargar = useCallback(() => setRefresh((n) => n + 1), []);

  if (err) return <ErrorBox text={`No se pudieron cargar las finanzas: ${err}`} />;
  if (!fin) return <LoadingBox text="Cargando finanzas…" />;

  const monedas = Object.keys(fin.finanzas || {});
  const principal = fin.finanzas?.PEN || fin.finanzas?.[monedas[0]] || {
    recaudado: 0, retirado: 0, comprometido: 0, disponible: 0,
  };
  const monedaPrincipal = fin.finanzas?.PEN ? "PEN" : (monedas[0] || "PEN");

  return (
    <section className={cardCls}>
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">💰 Finanzas de mi organización</h2>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <FinKpi label="Total recaudado" value={fmt(principal.recaudado, monedaPrincipal)} tone="text-emerald-600 dark:text-emerald-400" />
        <FinKpi label="Total retirado" value={fmt(principal.retirado, monedaPrincipal)} tone="text-slate-600 dark:text-slate-300" />
        <FinKpi label="En proceso de retiro" value={fmt(principal.comprometido, monedaPrincipal)} tone="text-amber-600 dark:text-amber-400" />
        <FinKpi label="Saldo disponible" value={fmt(principal.disponible, monedaPrincipal)} tone="text-sky-600 dark:text-sky-400" destacado />
      </div>
      {monedas.filter((m) => m !== monedaPrincipal).map((m) => (
        <p key={m} className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          En {m}: recaudado {fmt(fin.finanzas[m].recaudado, m)} · disponible {fmt(fin.finanzas[m].disponible, m)}
        </p>
      ))}

      <MetaEditor meta={fin.meta} onSaved={recargar} />
      <RetiroForm disponible={principal.disponible} moneda={monedaPrincipal} onSaved={recargar} />

      <h3 className="mt-5 text-sm font-extrabold text-slate-800 dark:text-slate-100">Historial de retiros</h3>
      {retiros === null ? (
        <LoadingBox text="Cargando retiros…" />
      ) : retiros.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-3">Solicitado</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Procesado</th>
                <th className="py-2 pr-3">Mi nota</th>
                <th className="py-2">Respuesta admin</th>
              </tr>
            </thead>
            <tbody>
              {retiros.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{fechaCorta(r.fecha_solicitud)}</td>
                  <td className="py-2 pr-3 font-bold text-slate-900 dark:text-white">{monto(r)}</td>
                  <td className="py-2 pr-3"><EstadoBadge estado={r.estado} /></td>
                  <td className="py-2 pr-3 text-slate-500 dark:text-slate-400">{r.fecha_procesamiento ? fechaCorta(r.fecha_procesamiento) : "—"}</td>
                  <td className="py-2 pr-3 text-xs text-slate-500 dark:text-slate-400">{r.nota || "—"}</td>
                  <td className="py-2 text-xs text-slate-500 dark:text-slate-400">{r.nota_admin || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Sin retiros todavía. Cuando tengas saldo disponible podrás solicitarlos aquí.
        </p>
      )}
    </section>
  );
}

function FinKpi({ label, value, tone, destacado }) {
  return (
    <div className={`rounded-xl border p-3 ${destacado
      ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
      : "border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60"}`}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`mt-0.5 truncate text-lg font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

function MetaEditor({ meta, onSaved }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({
    titulo: meta?.titulo || "",
    objetivo_monto: meta?.objetivo_monto || "",
    descripcion: meta?.descripcion || "",
  });
  const [state, setState] = useState({ saving: false, err: "" });

  const guardar = async (e) => {
    e.preventDefault();
    if (state.saving) return;
    setState({ saving: true, err: "" });
    try {
      await api.guardarMeta({
        titulo: form.titulo.trim(),
        objetivo_monto: Number(form.objetivo_monto),
        descripcion: form.descripcion.trim(),
        moneda: "PEN",
        activa: true,
      });
      setEditando(false);
      onSaved();
    } catch (err) {
      setState({ saving: false, err: err.detail || err.message });
      return;
    }
    setState({ saving: false, err: "" });
  };

  const desactivar = async () => {
    try {
      await api.guardarMeta({ titulo: "meta", objetivo_monto: 1, activa: false });
      onSaved();
    } catch { /* sin drama */ }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">🎯 Meta de recaudación</h3>
        <div className="flex gap-2">
          {meta && !editando && (
            <button onClick={desactivar} className="text-xs text-slate-400 hover:text-red-500">Desactivar</button>
          )}
          <button onClick={() => setEditando((v) => !v)}
                  className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            {editando ? "Cancelar" : meta ? "Editar meta" : "Crear meta"}
          </button>
        </div>
      </div>

      {meta && !editando && (
        <div className="mt-2">
          <GoalBar titulo={meta.titulo} recaudado={meta.recaudado}
                   objetivo={meta.objetivo_monto} moneda={meta.moneda} />
          {meta.descripcion && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{meta.descripcion}</p>}
        </div>
      )}
      {!meta && !editando && (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Crea una meta pública: los donantes verán una barra de avance en tu tarjeta del mapa.
        </p>
      )}

      {editando && (
        <form onSubmit={guardar} className="mt-2 grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
          <label className="block">
            <span className={labelCls}>Título de la meta</span>
            <input value={form.titulo} required minLength={3} maxLength={120}
                   onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                   placeholder="Ej. 100 menús para diciembre" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Objetivo (S/)</span>
            <input type="number" min="1" step="1" required value={form.objetivo_monto}
                   onChange={(e) => setForm({ ...form, objetivo_monto: e.target.value })}
                   className={inputCls} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={state.saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300">
              {state.saving ? "…" : "Guardar"}
            </button>
          </div>
          <label className="block sm:col-span-3">
            <span className={labelCls}>Descripción (opcional)</span>
            <input value={form.descripcion} maxLength={300}
                   onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                   className={inputCls} />
          </label>
          {state.err && <p className="text-sm text-red-600 sm:col-span-3">{state.err}</p>}
        </form>
      )}
    </div>
  );
}

function RetiroForm({ disponible, moneda, onSaved }) {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ monto: "", nota: "" });
  const [state, setState] = useState({ saving: false, msg: "", err: "" });

  const puede = Number(form.monto) > 0 && Number(form.monto) <= disponible;

  const enviar = async (e) => {
    e.preventDefault();
    if (!puede || state.saving) return;
    setState({ saving: true, msg: "", err: "" });
    try {
      await api.solicitarRetiro({ monto: Number(form.monto), moneda, nota: form.nota.trim() });
      setForm({ monto: "", nota: "" });
      setAbierto(false);
      setState({ saving: false, msg: "Retiro solicitado: quedará pendiente hasta su procesamiento.", err: "" });
      onSaved();
    } catch (err) {
      setState({ saving: false, msg: "", err: err.detail || err.message });
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/30">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">🏦 Retirar fondos</h3>
        <button onClick={() => setAbierto((v) => !v)}
                disabled={disponible <= 0 && !abierto}
                className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-600">
          {abierto ? "Cancelar" : "Solicitar retiro"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Disponible: <b>{fmt(disponible, moneda)}</b>. El sistema no permite retirar más que el saldo disponible.
      </p>

      {abierto && (
        <form onSubmit={enviar} className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <label className="block">
            <span className={labelCls}>Monto ({moneda})</span>
            <input type="number" min="1" step="0.01" max={disponible} required
                   value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })}
                   className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Nota (opcional)</span>
            <input value={form.nota} maxLength={300}
                   onChange={(e) => setForm({ ...form, nota: e.target.value })}
                   placeholder="Ej. compra de insumos de la semana" className={inputCls} />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={!puede || state.saving}
                    className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-600">
              {state.saving ? "…" : "Confirmar"}
            </button>
          </div>
        </form>
      )}
      {state.msg && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{state.msg}</p>}
      {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
    </div>
  );
}

/* ---- Perfil de la organización (crear/editar) ---- */

function OrgForm({ org, onSaved }) {
  const creating = !org;
  const [form, setForm] = useState(() => ({
    nombre: org?.nombre || "",
    tipo: org?.tipo || "olla_comun",
    nivel_necesidad: org?.nivel_necesidad || 3,
    descripcion: org?.descripcion || "",
    dept: org?.ubigeo ? String(org.ubigeo).slice(0, 2) : "",
    ubigeo: org?.ubigeo || "",
    activa: org?.activa ?? true,
    direccion: org?.direccion || "",
    telefono: org?.telefono || "",
    email_contacto: org?.email_contacto || "",
    ruc: org?.ruc || "",
    cobertura: org?.cobertura || "",
  }));
  const [state, setState] = useState({ saving: false, msg: "", err: "" });

  const localidades = localidadesDeDepartamento(form.dept);
  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => (k === "dept" ? { ...f, dept: v, ubigeo: "" } : { ...f, [k]: v }));
  };

  const valid = form.nombre.trim().length >= 3 && /^\d{6}$/.test(form.ubigeo)
    && (!form.ruc || /^\d{11}$/.test(form.ruc))
    && (!form.telefono || /^[0-9+() -]{6,15}$/.test(form.telefono));

  const save = async (e) => {
    e.preventDefault();
    if (!valid || state.saving) return;
    setState({ saving: true, msg: "", err: "" });
    const payload = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      nivel_necesidad: Number(form.nivel_necesidad),
      descripcion: form.descripcion.trim(),
      ubigeo: form.ubigeo,
      direccion: form.direccion.trim() || null,
      telefono: form.telefono.trim() || null,
      email_contacto: form.email_contacto.trim() || null,
      ruc: form.ruc.trim() || null,
      cobertura: form.cobertura.trim() || null,
      ...(creating ? {} : { activa: form.activa }),
    };
    try {
      const r = creating ? await api.crearOrg(payload) : await api.updMiOrg(payload);
      onSaved(r.data);
      setState({ saving: false, msg: creating ? "Organización registrada." : "Cambios guardados.", err: "" });
    } catch (err) {
      const msg = err.status === 409
        ? (err.detail || "Ya existe una organización registrada con esos datos.")
        : (err.detail?.[0]?.msg || err.message);
      setState({ saving: false, msg: "", err: String(msg) });
    }
  };

  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {!creating && (
            <AvatarUploader
              size="lg"
              src={org.avatar_url}
              nombre={org.nombre}
              onUpload={async (body) => {
                const r = await api.subirAvatarOrg(body);
                onSaved({ ...org, avatar_url: r.avatar_url });
              }}
            />
          )}
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
            {creating ? "Registrar mi organización" : "Perfil de mi organización"}
          </h2>
        </div>
        {!creating && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${org.activa ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
            {org.activa ? "Visible en el mapa" : "Oculta del mapa"}
          </span>
        )}
      </div>
      {creating && (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Cada cuenta puede registrar una sola organización. Después podrás editarla desde aquí.
        </p>
      )}

      <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Nombre (mín. 3 caracteres)</span>
          <input value={form.nombre} onChange={set("nombre")} required minLength={3} maxLength={120}
                 placeholder="Ej. Comedor Santa Rosa" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Tipo</span>
          <select value={form.tipo} onChange={set("tipo")} className={inputCls}>
            {TIPOS_ORG.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Nivel de necesidad (1–5)</span>
          <select value={form.nivel_necesidad} onChange={set("nivel_necesidad")} className={inputCls}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}{n === 5 ? " (máxima)" : n === 1 ? " (mínima)" : ""}</option>)}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Departamento</span>
          <select value={form.dept} onChange={set("dept")} required className={inputCls}>
            <option value="">Selecciona…</option>
            {DEPARTAMENTOS.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Distrito / localidad (UBIGEO)</span>
          <select value={form.ubigeo} onChange={set("ubigeo")} required disabled={!form.dept}
                  className={`${inputCls} disabled:bg-slate-50 disabled:text-slate-400 dark:disabled:bg-slate-800`}>
            <option value="">{form.dept ? "Selecciona…" : "Elige primero un departamento"}</option>
            {localidades.map((l) => (
              <option key={l.ubigeo} value={l.ubigeo}>
                {l.nombre} — {l.ubigeo} (prov. {l.provinciaCode})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Dirección (opcional)</span>
          <input value={form.direccion} onChange={set("direccion")} maxLength={200}
                 placeholder="Jr. Los Álamos 123" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Teléfono de contacto (opcional)</span>
          <input value={form.telefono} onChange={set("telefono")} maxLength={15}
                 placeholder="+51 999 999 999" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>Correo de contacto (opcional)</span>
          <input type="email" value={form.email_contacto} onChange={set("email_contacto")}
                 placeholder="contacto@miorganizacion.pe" className={inputCls} />
        </label>

        <label className="block">
          <span className={labelCls}>RUC (11 dígitos, opcional)</span>
          <input inputMode="numeric" value={form.ruc}
                 onChange={(e) => setForm({ ...form, ruc: e.target.value.replace(/\D/g, "").slice(0, 11) })}
                 placeholder="20123456789" className={`${inputCls} font-mono`} />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>Cobertura (opcional: a quiénes y dónde atienden)</span>
          <input value={form.cobertura} onChange={set("cobertura")} maxLength={300}
                 placeholder="Ej. 80 familias del AA.HH. Santa Rosa y anexos" className={inputCls} />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>Descripción (máx. 500)</span>
          <textarea value={form.descripcion} onChange={set("descripcion")} maxLength={500} rows={3}
                    placeholder="Qué hace tu organización, a cuántas familias atiende, qué necesita…"
                    className={inputCls} />
        </label>

        {!creating && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={form.activa} onChange={set("activa")}
                   className="h-4 w-4 accent-emerald-600" />
            Mostrar mi organización en el mapa (activa)
          </label>
        )}

        <div className="flex items-end justify-end sm:col-span-2">
          <button type="submit" disabled={!valid || state.saving}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-600">
            {state.saving ? "Guardando…" : creating ? "Registrar organización" : "Guardar cambios"}
          </button>
        </div>
      </form>

      {form.ubigeo && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Ubicación seleccionada: <b>{ubigeoLabel(form.ubigeo)}</b> · UBIGEO {form.ubigeo}
        </p>
      )}
      {state.msg && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{state.msg}</p>}
      {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
    </section>
  );
}

/* ---- Métodos de cobro (privados: solo la org dueña y el admin) ---- */

const METODO_VACIO = {
  tipo: "banco", titular: "", banco: "", tipo_cuenta: "ahorros",
  numero_cuenta: "", cci: "", yape_numero: "", observaciones: "", principal: false,
};

function MetodosCobroSection() {
  const [metodos, setMetodos] = useState(null);
  const [form, setForm] = useState(null); // null = cerrado; {...} = creando/editando
  const [state, setState] = useState({ saving: false, err: "" });

  const cargar = () => api.metodosCobro().then((r) => setMetodos(r.data)).catch(() => setMetodos([]));
  useEffect(() => { cargar(); }, []);

  const set = (k) => (e) => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const valido = form && form.titular.trim().length >= 3 && (
    form.tipo === "yape"
      ? /^9\d{8}$/.test(form.yape_numero)
      : form.banco.trim() && /^[0-9-]{8,20}$/.test(form.numero_cuenta) && (!form.cci || /^\d{20}$/.test(form.cci))
  );

  const guardar = async (e) => {
    e.preventDefault();
    if (!valido || state.saving) return;
    setState({ saving: true, err: "" });
    const body = {
      tipo: form.tipo,
      titular: form.titular.trim(),
      principal: !!form.principal,
      observaciones: form.observaciones.trim() || null,
      ...(form.tipo === "banco"
        ? { banco: form.banco.trim(), tipo_cuenta: form.tipo_cuenta,
            numero_cuenta: form.numero_cuenta.trim(), cci: form.cci.trim() || null }
        : { yape_numero: form.yape_numero.trim() }),
    };
    try {
      if (form.id) await api.editarMetodoCobro(form.id, body);
      else await api.crearMetodoCobro(body);
      setForm(null);
      setState({ saving: false, err: "" });
      cargar();
    } catch (err) {
      setState({ saving: false, err: err.detail?.[0]?.msg || err.detail || err.message });
    }
  };

  const marcarPrincipal = async (m) => {
    try {
      await api.editarMetodoCobro(m.id, {
        tipo: m.tipo, titular: m.titular, principal: true,
        banco: m.banco, tipo_cuenta: m.tipo_cuenta, numero_cuenta: m.numero_cuenta,
        cci: m.cci, yape_numero: m.yape_numero, observaciones: m.observaciones,
      });
      cargar();
    } catch { /* recarga mostrará el estado real */ }
  };

  const eliminar = async (m) => {
    if (!window.confirm(`¿Eliminar el método "${m.tipo === "yape" ? `Yape ${m.yape_numero}` : m.banco}"?`)) return;
    try { await api.borrarMetodoCobro(m.id); cargar(); } catch { /* idem */ }
  };

  return (
    <section className={cardCls}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">🏦 Mis datos de cobro</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A dónde se transfieren tus retiros. Solo los ven tú y el administrador — nunca son públicos.
          </p>
        </div>
        <button onClick={() => setForm(form ? null : { ...METODO_VACIO, principal: !(metodos?.length) })}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
          {form ? "Cancelar" : "+ Agregar método"}
        </button>
      </div>

      {form && (
        <form onSubmit={guardar} className="mt-3 grid gap-3 rounded-2xl border border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-600">
          <div className="flex gap-2 sm:col-span-2">
            {["banco", "yape"].map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, tipo: t }))}
                      className={`rounded-xl border-2 px-4 py-2 text-sm font-bold capitalize ${
                        form.tipo === t
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 dark:text-white"
                          : "border-slate-200 text-slate-500 dark:border-slate-600"}`}>
                {t === "banco" ? "🏦 Cuenta bancaria" : "📱 Yape"}
              </button>
            ))}
          </div>

          <label className="block sm:col-span-2">
            <span className={labelCls}>Titular (como figura en la cuenta)</span>
            <input value={form.titular} onChange={set("titular")} required minLength={3} maxLength={120} className={inputCls} />
          </label>

          {form.tipo === "banco" ? (
            <>
              <label className="block">
                <span className={labelCls}>Banco</span>
                <input value={form.banco} onChange={set("banco")} required maxLength={60}
                       placeholder="BCP, Interbank, BBVA…" className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Tipo de cuenta</span>
                <select value={form.tipo_cuenta} onChange={set("tipo_cuenta")} className={inputCls}>
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </label>
              <label className="block">
                <span className={labelCls}>Número de cuenta</span>
                <input value={form.numero_cuenta} onChange={set("numero_cuenta")} required
                       placeholder="8 a 20 dígitos" className={`${inputCls} font-mono`} />
              </label>
              <label className="block">
                <span className={labelCls}>CCI (opcional, 20 dígitos)</span>
                <input value={form.cci}
                       onChange={(e) => setForm((f) => ({ ...f, cci: e.target.value.replace(/\D/g, "").slice(0, 20) }))}
                       className={`${inputCls} font-mono`} />
              </label>
            </>
          ) : (
            <label className="block">
              <span className={labelCls}>Número Yape (9 dígitos, empieza en 9)</span>
              <input value={form.yape_numero}
                     onChange={(e) => setForm((f) => ({ ...f, yape_numero: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
                     required placeholder="9XXXXXXXX" className={`${inputCls} font-mono`} />
            </label>
          )}

          <label className="block sm:col-span-2">
            <span className={labelCls}>Observaciones (opcional)</span>
            <input value={form.observaciones} onChange={set("observaciones")} maxLength={300} className={inputCls} />
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={form.principal} onChange={set("principal")}
                   className="h-4 w-4 accent-emerald-600" />
            Usar como método principal
          </label>

          <div className="flex items-end justify-end">
            <button type="submit" disabled={!valido || state.saving}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-slate-300 dark:disabled:bg-slate-600">
              {state.saving ? "Guardando…" : form.id ? "Guardar cambios" : "Agregar"}
            </button>
          </div>
          {state.err && <p className="text-sm text-red-600 sm:col-span-2">{String(state.err)}</p>}
        </form>
      )}

      {metodos === null ? (
        <LoadingBox text="Cargando métodos de cobro…" />
      ) : metodos.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {metodos.map((m) => (
            <div key={m.id} className={`rounded-2xl border p-3.5 ${m.principal
              ? "border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30"
              : "border-slate-200 dark:border-slate-600"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {m.tipo === "yape" ? "📱 Yape" : `🏦 ${m.banco}`}
                </span>
                {m.principal
                  ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">PRINCIPAL</span>
                  : <button onClick={() => marcarPrincipal(m)}
                            className="text-[11px] font-semibold text-slate-400 hover:text-emerald-600">Hacer principal</button>}
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {m.titular}
                {m.tipo === "yape"
                  ? <> · <span className="font-mono">{m.yape_numero}</span></>
                  : <> · <span className="font-mono">{m.numero_cuenta}</span> ({m.tipo_cuenta || "—"})</>}
              </p>
              {m.cci && <p className="text-xs text-slate-400">CCI: <span className="font-mono">{m.cci}</span></p>}
              {m.observaciones && <p className="mt-1 text-xs text-slate-400">{m.observaciones}</p>}
              <div className="mt-2 flex justify-end gap-3 text-[11px] font-semibold">
                <button onClick={() => setForm({ ...METODO_VACIO, ...m })}
                        className="text-slate-500 hover:text-emerald-600">Editar</button>
                <button onClick={() => eliminar(m)} className="text-slate-400 hover:text-red-500">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          ⚠️ Aún no registras un método de cobro. Sin él, el administrador no podrá completar tus retiros.
        </div>
      )}
    </section>
  );
}

function OrgDonaciones() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.orgDonaciones().then(setData).catch((e) => {
      if (e.status !== 404) setErr(e.message);
    });
  }, []);

  if (err) return <ErrorBox text={`No se pudieron cargar las donaciones: ${err}`} />;
  if (!data) return <LoadingBox text="Cargando donaciones recibidas…" />;

  const { data: rows, resumen } = data;

  return (
    <section className={cardCls}>
      <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Donaciones recibidas</h2>

      <ResumenDonaciones resumen={resumen} etiquetaTotal="Total recibido" />

      {rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Donante</th>
                <th className="py-2 pr-3">Monto</th>
                <th className="py-2 pr-3">Método</th>
                <th className="py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700/60">
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">{fechaCorta(r.fecha)}</td>
                  <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-100">
                    {r.donante === "Donante anónimo" ? "🕶️ " : ""}{r.donante}
                  </td>
                  <td className="py-2 pr-3 font-bold text-slate-900 dark:text-white">{monto(r)}</td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                    {METODO_ICON[r.metodo_pago] || "💳"} {r.metodo_pago || "tarjeta"}
                  </td>
                  <td className="py-2"><EstadoBadge estado={r.estado} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4">
          <EmptyState
            title="Todavía no recibes donaciones"
            message="Tu organización ya es visible en el mapa: los donadores pueden encontrarla al explorar tu departamento. Crear una meta de recaudación ayuda a atraer apoyo."
          />
        </div>
      )}
    </section>
  );
}

/* ---------------- Piezas compartidas ---------------- */

function ResumenDonaciones({ resumen, etiquetaTotal }) {
  const totales = Object.entries(resumen.totales_completadas || {});
  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <MiniKpi label="Operaciones" value={resumen.cantidad} />
      <MiniKpi
        label={etiquetaTotal}
        value={totales.length ? totales.map(([m, t]) => `${m === "USD" ? "$" : "S/"} ${t.toFixed(2)}`).join(" · ") : "S/ 0.00"}
      />
      <MiniKpi label="Ingresadas" value={(resumen.por_estado?.completada || 0) + (resumen.por_estado?.confirmada || 0)} />
      <MiniKpi label="Pendientes" value={resumen.por_estado?.pendiente || 0} />
    </div>
  );
}

function MiniKpi({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-0.5 truncate text-base font-extrabold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}

function EstadoBadge({ estado }) {
  return (
    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${ESTADO_BADGE[estado] || "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
      {estado}
    </span>
  );
}

function LoadingBox({ text }) {
  return (
    <div className="rounded-2xl border bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{text}</p>
      <div className="nm-skeleton mt-3 h-3 w-full animate-shimmer rounded-full" />
      <div className="nm-skeleton mt-2 h-3 w-2/3 animate-shimmer rounded-full" />
    </div>
  );
}

function ErrorBox({ text }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{text}</div>;
}
