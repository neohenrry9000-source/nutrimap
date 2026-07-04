// Monitor de disponibilidad del backend. Silencioso cuando todo está
// bien: solo muestra una alerta si el servicio no responde.
import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function getHealthUrl() {
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}/health`;
  }
  return "/api/health";
}

export default function ApiStatus() {
  const [caido, setCaido] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch(getHealthUrl())
      .then((r) => r.json())
      .then((d) => !cancel && setCaido(d.status !== "ok"))
      .catch(() => !cancel && setCaido(true));
    return () => { cancel = true; };
  }, []);

  if (!caido) return null;

  return (
    <div className="mt-3 animate-fade-up rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.
    </div>
  );
}
