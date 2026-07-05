import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.jsx";
import ApiStatus from "../components/ApiStatus.jsx";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { CommunityIllustration } from "../components/illustrations.jsx";

const inputCls = "w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400";

export default function Login() {
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [form, setForm] = useState({ email: "", password: "", rol: "donador" });
  const [state, setState] = useState({ loading: false, err: "" });
  const { login } = useAuth();
  const nav = useNavigate();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, err: "" });
    try {
      if (mode === "register") {
        await api.register(form);
      }
      const { rol } = await api.login({
        email: form.email, password: form.password
      });
      // El AuthProvider re-renderiza las rutas al instante:
      // no hace falta recargar la página.
      login(rol);
      nav("/", { replace: true });
    } catch (err) {
      setState({ loading: false,
                 err: err.status === 401 ? "Credenciales inválidas"
                    : err.status === 403 ? (err.detail || "Tu cuenta fue bloqueada. Contacta al administrador.")
                    : err.status === 409 ? "Ese email ya está registrado"
                    : "Error: " + err.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br
                    from-emerald-50 via-slate-50 to-sky-50 p-4 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <div className="grid w-full max-w-4xl animate-fade-up overflow-hidden rounded-3xl bg-white shadow-2xl shadow-emerald-900/10 lg:grid-cols-2 dark:bg-slate-800 dark:shadow-black/40">

        {/* -------- Panel ilustrado (solo desktop) -------- */}
        <div className="relative hidden flex-col justify-between bg-gradient-to-br from-emerald-600 to-teal-700 p-8 lg:flex">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">Plataforma solidaria</p>
            <h2 className="mt-2 text-2xl font-extrabold leading-snug text-white">
              Cada donación llega<br />donde más se necesita.
            </h2>
          </div>
          <CommunityIllustration className="mx-auto my-4 w-64 animate-float" />
          <ul className="space-y-2 text-sm text-emerald-50/90">
            <li className="flex items-center gap-2"><Dot /> Mapa de riesgo con data oficial ENDES 2024</li>
            <li className="flex items-center gap-2"><Dot /> Ollas comunes y comedores por distrito</li>
            <li className="flex items-center gap-2"><Dot /> Dona con tarjeta o Yape, incluso de forma anónima</li>
          </ul>
        </div>

        {/* -------- Formulario -------- */}
        <div className="p-8">
          <div className="flex items-start justify-between">
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white">
              NutriMap <span className="text-emerald-600">·</span> Perú
            </h1>
            <ThemeToggle />
          </div>
          <p className="text-sm text-slate-500 mb-5 dark:text-slate-400">
            Mapa de riesgo nutricional infantil del Perú
          </p>
          <ApiStatus />

          <div className="mt-4 mb-5 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-700">
            {["login","register"].map((m) => (
              <button key={m} type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors ${
                        mode === m ? "bg-white shadow text-slate-800 dark:bg-slate-600 dark:text-white"
                                   : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"}`}>
                {m === "login" ? "Ingresar" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <input required type="email" placeholder="Email"
                   value={form.email} onChange={set("email")} className={inputCls} />
            <input required type="password" placeholder="Contraseña (mín. 10)"
                   minLength={mode === "register" ? 10 : 1}
                   value={form.password} onChange={set("password")} className={inputCls} />

            {mode === "register" && (
              <select value={form.rol} onChange={set("rol")}
                      className={`${inputCls} bg-white`}>
                <option value="donador">Donador</option>
                <option value="organizacion">Organización (olla / comedor)</option>
              </select>
            )}

            {state.err && <p className="animate-fade-up text-sm text-red-600">{state.err}</p>}

            <button type="submit" disabled={state.loading}
              className="nm-press w-full rounded-xl bg-emerald-600 py-2.5 font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 hover:shadow-emerald-600/40 disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-600">
              {state.loading ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
            🔒 Tus datos están protegidos: nunca almacenamos información de pago.
          </p>
        </div>
      </div>
    </div>
  );
}

function Dot() {
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />;
}
