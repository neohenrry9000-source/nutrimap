import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { useAuth } from "../hooks/useAuth.js";
import ApiStatus from "../components/ApiStatus.jsx";

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
      login(rol);
      nav("/");
    } catch (err) {
      setState({ loading: false,
                 err: err.status === 401 ? "Credenciales inválidas"
                    : err.status === 409 ? "Ese email ya está registrado"
                    : "Error: " + err.message });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br
                    from-emerald-50 to-amber-50 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-slate-800">NutriMap</h1>
        <p className="text-sm text-slate-500 mb-6">
          Mapa de riesgo nutricional infantil del Perú
        </p>
        <ApiStatus />

        <p className="mt-3 mb-6 text-xs leading-relaxed text-slate-500">
          Plataforma web para visualizar riesgo nutricional infantil, cobertura de apoyo alimentario y datos por zonas del Perú.
        </p>

        <div className="flex bg-slate-100 rounded p-1 mb-5">
          {["login","register"].map((m) => (
            <button key={m} type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded text-sm font-medium ${
                      mode === m ? "bg-white shadow text-slate-800"
                                 : "text-slate-500"}`}>
              {m === "login" ? "Ingresar" : "Crear cuenta"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <input required type="email" placeholder="Email"
                 value={form.email} onChange={set("email")}
                 className="w-full border rounded px-3 py-2"/>
          <input required type="password" placeholder="Contraseña (mín. 10)"
                 minLength={mode === "register" ? 10 : 1}
                 value={form.password} onChange={set("password")}
                 className="w-full border rounded px-3 py-2"/>

          {mode === "register" && (
            <select value={form.rol} onChange={set("rol")}
                    className="w-full border rounded px-3 py-2 bg-white">
              <option value="donador">Donador</option>
              <option value="organizacion">Organización (olla / comedor)</option>
            </select>
          )}

          {state.err && <p className="text-sm text-red-600">{state.err}</p>}

          <button type="submit" disabled={state.loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300
                       text-white font-medium py-2 rounded">
            {state.loading ? "..." : mode === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}
