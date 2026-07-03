import { useState, useEffect, useCallback } from "react";
import { setToken, setRol, getRol } from "../services/api.js";

export function useAuth() {
  // Aquí recuperamos las variables que la IA te había borrado:
  const [token, setTk] = useState(() => sessionStorage.getItem("nm_token"));
  const [rol, setR]    = useState(() => getRol());

  const login = useCallback((tk, r) => {
    setToken(tk); setRol(r); setTk(tk); setR(r);
  }, []);
  
  const logout = useCallback(() => {
    setToken(null); setRol(null); setTk(null); setR(null);
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