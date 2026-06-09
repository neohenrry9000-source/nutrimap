import { useState } from "react";
import { api } from "../services/api.js";

export default function DonateModal({ org, onClose }) {
  const [form, setForm] = useState({ monto: "20", card: "", exp: "", cvv: "" });
  const [state, setState] = useState({ loading: false, ok: false, err: "" });

  if (!org) return null;

  const onChange = (k) => (e) => {
    let v = e.target.value;
    if (k === "card") v = v.replace(/\D/g, "").slice(0, 16);
    if (k === "cvv")  v = v.replace(/\D/g, "").slice(0, 3);
    if (k === "exp")  v = v.replace(/[^\d/]/g, "").slice(0, 5);
    setForm({ ...form, [k]: v });
  };

  const valid =
    Number(form.monto) > 0 &&
    form.card.length === 16 &&
    /^\d{2}\/\d{2}$/.test(form.exp) &&
    form.cvv.length === 3;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid || state.loading) return;
    setState({ loading: true, ok: false, err: "" });
    try {
      await api.donar({
        id_organizacion: org.id,
        monto: Number(form.monto),
        moneda: "PEN",
        card_number: form.card,
        card_exp:    form.exp,
        card_cvv:    form.cvv,
      });
      setState({ loading: false, ok: true, err: "" });
      setForm({ monto: "20", card: "", exp: "", cvv: "" });
    } catch (err) {
      setState({ loading: false, ok: false, err: err.message || "Error" });
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/40 flex items-center justify-center p-4"
         onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Apoyar a</h3>
            <p className="text-sm text-slate-600">{org.nombre}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 text-xl">×</button>
        </div>

        <div className="mt-3 rounded bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
          🔒 Esta es una pasarela <b>DEMO</b>. No se procesa ningún pago
          real. Los datos de tarjeta no se almacenan.
        </div>

        {state.ok ? (
          <div className="mt-6 text-center">
            <div className="text-emerald-600 text-3xl">✓</div>
            <p className="mt-2 font-semibold">¡Donación registrada!</p>
            <button onClick={onClose}
                    className="mt-4 px-4 py-2 bg-slate-800 text-white rounded">
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <Field label="Monto (S/.)">
              <input type="number" min="1" step="1" required
                     value={form.monto} onChange={onChange("monto")}
                     className="w-full border rounded px-3 py-2"/>
            </Field>
            <Field label="Número de tarjeta">
              <input inputMode="numeric" required placeholder="16 dígitos"
                     value={form.card} onChange={onChange("card")}
                     className="w-full border rounded px-3 py-2 font-mono"/>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expiración (MM/AA)">
                <input required placeholder="MM/AA"
                       value={form.exp} onChange={onChange("exp")}
                       className="w-full border rounded px-3 py-2 font-mono"/>
              </Field>
              <Field label="CVV">
                <input inputMode="numeric" required placeholder="3 dígitos"
                       value={form.cvv} onChange={onChange("cvv")}
                       className="w-full border rounded px-3 py-2 font-mono"/>
              </Field>
            </div>
            {state.err && <p className="text-sm text-red-600">{state.err}</p>}
            <button type="submit" disabled={!valid || state.loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300
                         text-white font-medium py-2 rounded">
              {state.loading ? "Procesando..." : `Donar S/ ${form.monto}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}
