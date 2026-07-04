// Autenticación como CONTEXTO compartido (una sola fuente de verdad).
//
// Antes cada componente que llamaba useAuth() creaba SU PROPIA copia de
// estado: al hacer logout desde el Dashboard, App.jsx (que decide las
// rutas) nunca se enteraba y la UI quedaba en estado zombi hasta
// recargar. Con el Provider, login/logout re-renderizan toda la app al
// instante: header, rutas y guards reaccionan sin refresh manual.
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api, setRol, getRol } from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [rol, setR] = useState(() => getRol());

  const login = useCallback((r) => {
    setRol(r);
    setR(r);
  }, []);

  const logout = useCallback(() => {
    // La cookie es HttpOnly: solo el backend puede borrarla.
    api.logout().catch(() => {});
    setRol(null);
    setR(null);
  }, []);

  const value = useMemo(() => ({ rol, login, logout }), [rol, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
