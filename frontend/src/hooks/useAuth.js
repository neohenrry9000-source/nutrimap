import { useState, useCallback } from "react";
import { setRol, getRol } from "../services/api.js";

export function useAuth() {
  const [rol, setR] = useState(() => getRol());

  const login = useCallback((r) => {
    setRol(r); setR(r);
  }, []);
  
  const logout = useCallback(() => {
    setRol(null); setR(null);
  }, []);

  useEffect(() => {
    const onStorage = () => setTk(sessionStorage.getItem("nm_token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // 1. Creamos la variable isAuth evaluando si existe un token
  const isAuth = Boolean(token);

  // 2. Exportamos isAuth junto con lo demás
  return { isAuth, token, rol, login, logout };
}
