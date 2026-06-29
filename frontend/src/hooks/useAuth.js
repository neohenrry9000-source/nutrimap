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

  return { rol, login, logout };
}
