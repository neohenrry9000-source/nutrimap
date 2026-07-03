import { useEffect, useState } from "react";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

function getHealthUrl() {
  if (API_BASE_URL) {
    return `${API_BASE_URL.replace(/\/$/, "")}/health`;
  }

  return "/api/health";
}

export default function ApiStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    async function checkBackend() {
      try {
        const response = await fetch(getHealthUrl());

        if (!response.ok) {
          setStatus("offline");
          return;
        }

        const data = await response.json();

        if (data.status === "ok") {
          setStatus("online");
        } else {
          setStatus("warning");
        }
      } catch {
        setStatus("offline");
      }
    }

    checkBackend();
  }, []);

  const styles = {
    checking: {
      text: "Verificando conexión con el backend...",
      className: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    online: {
      text: "Backend conectado correctamente",
      className: "bg-green-50 text-green-700 border-green-200",
    },
    warning: {
      text: "Backend responde, pero con estado inesperado",
      className: "bg-orange-50 text-orange-700 border-orange-200",
    },
    offline: {
      text: "No se pudo conectar con el backend",
      className: "bg-red-50 text-red-700 border-red-200",
    },
  };

  const current = styles[status];

  return (
    <div
      className={`mt-3 rounded-xl border px-4 py-2 text-sm font-medium ${current.className}`}
    >
      {current.text}
    </div>
  );
}