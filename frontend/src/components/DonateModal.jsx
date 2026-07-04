// Modal de donación con dos métodos (tarjeta demo / Yape), opción de
// anonimato y comprobante descargable.
//
// Flujo Yape: se registra la donación (pendiente) -> se muestran número,
// titular y código de operación -> el donante yapea y presiona
// "Ya pagué" -> la donación pasa a confirmada.
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";

function descargarComprobante({ org, monto, moneda, referencia, metodo, anonima }) {
  const fecha = new Date().toLocaleString("es-PE");
  const texto = [
    "══════════════════════════════════════",
    "   NutriMap · Comprobante de donación",
    "══════════════════════════════════════",
    `Fecha:        ${fecha}`,
    `Organización: ${org?.nombre || "-"}`,
    `Monto:        ${moneda === "USD" ? "$" : "S/"} ${Number(monto).toFixed(2)}`,
    `Método:       ${metodo === "yape" ? "Yape" : "Tarjeta"}`,
    `Anónima:      ${anonima ? "Sí (tu nombre no se muestra públicamente)" : "No"}`,
    `Referencia:   ${referencia}`,
    "",
    "Gracias por apoyar la lucha contra la anemia infantil. 💚",
  ].join("\n");
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nutrimap_donacion_${referencia.slice(0, 8)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const inputCls = "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100";

export default function DonateModal({ org, onClose }) {
  const [metodo, setMetodo] = useState("tarjeta");
  const [anonima, setAnonima] = useState(false);
  const [form, setForm] = useState({ monto: "20", card: "", exp: "", cvv: "" });
  const [state, setState] = useState({ loading: false, fase: "form", err: "" });
  const [resultado, setResultado] = useState(null); // respuesta del backend
  const [copiado, setCopiado] = useState(false);

  if (!org) return null;

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "card") v = v.replace(/\D/g, "").slice(0, 16);
    if (k === "cvv")  v = v.replace(/\D/g, "").slice(0, 3);
    if (k === "exp")  v = v.replace(/[^\d/]/g, "").slice(0, 5);
    setForm({ ...form, [k]: v });
  };

  const montoValido = Number(form.monto) > 0;
  const tarjetaValida = form.card.length === 16 && /^\d{2}\/\d{2}$/.test(form.exp) && form.cvv.length === 3;
  const valid = montoValido && (metodo === "yape" || tarjetaValida);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid || state.loading) return;
    setState({ loading: true, fase: "form", err: "" });
    try {
      const body = {
        id_organizacion: org.id,
        monto: Number(form.monto),
        moneda: "PEN",
        metodo_pago: metodo,
        es_anonima: anonima,
      };
      if (metodo === "tarjeta") {
        body.card_number = form.card;
        body.card_exp = form.exp;
        body.card_cvv = form.cvv;
      }
      const r = await api.donar(body);
      setResultado(r);
      setState({ loading: false, fase: metodo === "yape" ? "yape" : "ok", err: "" });
    } catch (err) {
      setState({ loading: false, fase: "form", err: err.detail || err.message || "Error" });
    }
  };

  const confirmarYape = async () => {
    if (state.loading || !resultado?.donacion?.id) return;
    setState((s) => ({ ...s, loading: true, err: "" }));
    try {
      await api.confirmarDonacion(resultado.donacion.id);
      setState({ loading: false, fase: "ok", err: "" });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, err: err.detail || err.message }));
    }
  };

  const copiarNumero = async () => {
    try {
      await navigator.clipboard.writeText((resultado?.yape?.numero || "").replace(/\s/g, ""));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* clipboard bloqueado: sin drama */ }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex animate-overlay-in items-center justify-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md animate-scale-in rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Apoyar a</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">{org.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 text-xl hover:text-slate-600 dark:hover:text-slate-200">×</button>
        </div>

        {/* ------------------- ÉXITO ------------------- */}
        {state.fase === "ok" && (
          <div className="mt-6 text-center">
            <div className="text-emerald-600 text-3xl">✓</div>
            <p className="mt-2 font-semibold dark:text-slate-100">
              {metodo === "yape" ? "¡Pago Yape registrado!" : "¡Donación registrada!"}
            </p>
            {anonima && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                🕶️ Donación anónima: tu nombre no se mostrará públicamente.
              </p>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => descargarComprobante({
                  org, monto: form.monto, moneda: "PEN",
                  referencia: resultado?.referencia || "", metodo, anonima,
                })}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                📄 Comprobante
              </button>
              <Link to="/panel" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm">
                Ver mi historial
              </Link>
              <button onClick={onClose} className="px-4 py-2 bg-slate-800 dark:bg-slate-600 text-white rounded text-sm">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* ------------------- PANTALLA YAPE ------------------- */}
        {state.fase === "yape" && resultado?.yape && (
          <div className="mt-4">
            <div className="rounded-2xl border-2 border-purple-300 bg-purple-50 p-4 text-center dark:border-purple-700 dark:bg-purple-950/40">
              <p className="text-xs font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">Yapea a</p>
              <p className="mt-1 text-2xl font-extrabold tracking-wider text-purple-900 dark:text-purple-100">
                {resultado.yape.numero}
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300">{resultado.yape.titular}</p>
              <button onClick={copiarNumero}
                      className="mt-2 rounded-full bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700">
                {copiado ? "✓ Copiado" : "📋 Copiar número"}
              </button>
              <div className="mt-3 rounded-xl bg-white p-3 text-left text-sm dark:bg-slate-800">
                <p className="dark:text-slate-200">Monto: <b>S/ {Number(form.monto).toFixed(2)}</b></p>
                <p className="dark:text-slate-200">Código de operación: <b className="font-mono">{resultado.yape.codigo}</b></p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Escribe el código en el mensaje del Yape para identificar tu apoyo.</p>
              </div>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
              {(resultado.yape.instrucciones || []).map((t, i) => <li key={i}>{t}</li>)}
            </ol>
            {state.err && <p className="mt-2 text-sm text-red-600">{state.err}</p>}
            <button
              onClick={confirmarYape} disabled={state.loading}
              className="mt-4 w-full rounded bg-purple-600 py-2.5 font-semibold text-white hover:bg-purple-700 disabled:bg-slate-300"
            >
              {state.loading ? "Confirmando…" : "✅ Ya pagué"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              Tu donación quedará <b>pendiente</b> hasta que confirmes el pago.
            </p>
          </div>
        )}

        {/* ------------------- FORMULARIO ------------------- */}
        {state.fase === "form" && (
          <>
            <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-2 text-xs text-slate-500 dark:bg-slate-700/50 dark:border-slate-600 dark:text-slate-400">
              🔒 Pago protegido: nunca almacenamos los datos de tu tarjeta.
            </div>

            {/* Selector de método */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {[
                { id: "tarjeta", label: "💳 Tarjeta", activo: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" },
                { id: "yape",    label: "📱 Yape",    activo: "border-purple-500 bg-purple-50 dark:bg-purple-950/40" },
              ].map((m) => (
                <button key={m.id} type="button" onClick={() => setMetodo(m.id)}
                        className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition dark:text-slate-100 ${
                          metodo === m.id ? m.activo : "border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-600"}`}>
                  {m.label}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              <Field label="Monto (S/.)">
                <input type="number" min="1" step="1" required value={form.monto}
                       onChange={onChange("monto")} className={inputCls} />
              </Field>

              {metodo === "tarjeta" && (
                <>
                  <Field label="Número de tarjeta">
                    <input inputMode="numeric" required placeholder="16 dígitos"
                           value={form.card} onChange={onChange("card")}
                           className={`${inputCls} font-mono`} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiración (MM/AA)">
                      <input required placeholder="MM/AA" value={form.exp}
                             onChange={onChange("exp")} className={`${inputCls} font-mono`} />
                    </Field>
                    <Field label="CVV">
                      <input inputMode="numeric" required placeholder="3 dígitos"
                             value={form.cvv} onChange={onChange("cvv")}
                             className={`${inputCls} font-mono`} />
                    </Field>
                  </div>
                </>
              )}

              {metodo === "yape" && (
                <p className="rounded-xl bg-purple-50 p-3 text-xs leading-5 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                  Al continuar te mostraremos el número Yape, el titular y un código
                  de operación para completar tu apoyo desde tu app.
                </p>
              )}

              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-200">
                <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)}
                       className="mt-0.5 h-4 w-4 accent-emerald-600" />
                <span>
                  <b>Donar como anónimo</b>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    Tu nombre no aparecerá en el feed público ni para la organización.
                    Tú seguirás viendo esta donación en tu historial.
                  </span>
                </span>
              </label>

              {state.err && <p className="text-sm text-red-600">{state.err}</p>}
              <button type="submit" disabled={!valid || state.loading}
                className={`w-full text-white font-medium py-2.5 rounded disabled:bg-slate-300 dark:disabled:bg-slate-600 ${
                  metodo === "yape" ? "bg-purple-600 hover:bg-purple-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                {state.loading ? "Procesando..."
                  : metodo === "yape" ? `Continuar con Yape · S/ ${form.monto}`
                  : `Donar S/ ${form.monto}`}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </label>
  );
}
