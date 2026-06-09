// Mantiene consistencia con el pipeline (mismos hex).
export const NIVELES = [
  { key: "MUY_ALTO", label: "Muy alto", color: "#c0392b" },
  { key: "ALTO",     label: "Alto",     color: "#e67e22" },
  { key: "MEDIO",    label: "Medio",    color: "#f1c40f" },
  { key: "BAJO",     label: "Bajo",     color: "#2ecc71" },
  { key: "SIN_DATOS",label: "Sin datos",color: "#bdc3c7" },
];

export const colorFor = (nivel) =>
  NIVELES.find((n) => n.key === nivel)?.color || "#bdc3c7";
