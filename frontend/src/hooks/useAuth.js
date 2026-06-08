import { useState, useEffect, useCallback } from "react";
import { setToken, setRol, getRol } from "../services/api.js";

export function useAuth() {
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

  return { token, rol, login, logout };
}
