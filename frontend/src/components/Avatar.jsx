// Avatar con fallback elegante: iniciales sobre un gradiente
// determinístico (mismo nombre => mismos colores, sin aleatoriedad).
const GRADIENTES = [
  ["#10b981", "#0ea5e9"], ["#f59e0b", "#ef4444"], ["#8b5cf6", "#ec4899"],
  ["#14b8a6", "#84cc16"], ["#6366f1", "#06b6d4"], ["#f97316", "#eab308"],
];

function hashCode(str = "") {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function iniciales(nombre = "") {
  const partes = String(nombre).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes[1]?.[0] || "")).toUpperCase();
}

const SIZES = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-24 w-24 text-2xl",
};

export default function Avatar({ src, nombre = "", size = "md", className = "" }) {
  const cls = `${SIZES[size] || SIZES.md} shrink-0 rounded-full object-cover ring-2 ring-white shadow dark:ring-slate-700 ${className}`;

  if (src) {
    return <img src={src} alt={nombre || "avatar"} className={cls} loading="lazy" />;
  }
  const [c1, c2] = GRADIENTES[hashCode(nombre) % GRADIENTES.length];
  return (
    <span
      aria-label={nombre || "avatar"}
      className={`${cls} grid place-items-center font-extrabold text-white`}
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {iniciales(nombre)}
    </span>
  );
}
