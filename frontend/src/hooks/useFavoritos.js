// Departamentos favoritos del usuario (persistidos en localStorage).
import { useCallback, useState } from "react";

const KEY = "nm_favoritos";

function leer() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function useFavoritos() {
  const [favoritos, setFavoritos] = useState(leer);

  const toggleFavorito = useCallback((code) => {
    setFavoritos((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { favoritos, toggleFavorito, esFavorito: (c) => favoritos.includes(c) };
}
