// Medalla SVG vectorial del nivel de donador. Sin imágenes externas:
// gradientes y destellos propios por tier, elegante en claro y oscuro.
const TIERS = {
  semilla:  { c1: "#a3b18a", c2: "#588157", emoji: "🌱" },
  bronce:   { c1: "#e0a96d", c2: "#a05a2c", emoji: "🥉" },
  plata:    { c1: "#d7dde4", c2: "#8a94a6", emoji: "🥈" },
  oro:      { c1: "#ffd97a", c2: "#c8901a", emoji: "🥇" },
  platino:  { c1: "#bff0e6", c2: "#4fa596", emoji: "💠" },
  diamante: { c1: "#c9e4ff", c2: "#5b8ddb", emoji: "💎" },
};

function Sparkle({ x, y, s = 1, opacity = 1 }) {
  return (
    <path
      d={`M${x} ${y - 4 * s} L${x + 1.2 * s} ${y - 1.2 * s} L${x + 4 * s} ${y} L${x + 1.2 * s} ${y + 1.2 * s} L${x} ${y + 4 * s} L${x - 1.2 * s} ${y + 1.2 * s} L${x - 4 * s} ${y} L${x - 1.2 * s} ${y - 1.2 * s} Z`}
      fill="#fff" opacity={opacity}
    />
  );
}

export default function DonorBadge({ clave = "semilla", nombre = "Semilla", size = 92 }) {
  const t = TIERS[clave] || TIERS.semilla;
  const id = `medal-${clave}`;

  return (
    <div className="flex animate-pop flex-col items-center" title={`Nivel ${nombre}`}>
      <svg width={size} height={size * 1.2} viewBox="0 0 100 120" role="img" aria-label={`Medalla ${nombre}`}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={t.c1} />
            <stop offset="100%" stopColor={t.c2} />
          </linearGradient>
          <linearGradient id={`${id}-r`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.c2} />
            <stop offset="100%" stopColor={t.c1} />
          </linearGradient>
          <radialGradient id={`${id}-halo`} cx=".5" cy=".45" r=".6">
            <stop offset="0%" stopColor={t.c1} stopOpacity=".55" />
            <stop offset="100%" stopColor={t.c1} stopOpacity="0" />
          </radialGradient>
          <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2.5" stdDeviation="3" floodColor={t.c2} floodOpacity=".45" />
          </filter>
        </defs>

        {/* Halo suave detrás de la medalla */}
        <circle cx="50" cy="74" r="44" fill={`url(#${id}-halo)`} />

        {/* Cintas con pliegue */}
        <path d="M34 2 L50 36 L27 48 L16 12 Z" fill={`url(#${id}-r)`} opacity=".95" />
        <path d="M66 2 L50 36 L73 48 L84 12 Z" fill={`url(#${id}-r)`} opacity=".75" />
        <path d="M34 2 L38 4 L50 36 L27 48 Z" fill="#000" opacity=".08" />

        {/* Medalla */}
        <g filter={`url(#${id}-shadow)`}>
          <circle cx="50" cy="74" r="33" fill={`url(#${id}-g)`} />
        </g>
        <circle cx="50" cy="74" r="33" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="2" />
        {/* Anillo interior con muescas de "acuñado" */}
        <circle cx="50" cy="74" r="26.5" fill="none" stroke="rgba(255,255,255,.4)"
                strokeWidth="1.6" strokeDasharray="2.4 3.6" />
        <circle cx="50" cy="74" r="22" fill="rgba(255,255,255,.12)" />

        {/* Brillo especular */}
        <ellipse cx="37" cy="60" rx="11" ry="6.5" fill="rgba(255,255,255,.4)" transform="rotate(-28 37 60)" />

        {/* Emoji del tier */}
        <text x="50" y="82.5" textAnchor="middle" fontSize="23">{t.emoji}</text>

        {/* Destellos */}
        <Sparkle x={76} y={52} s={1.1} opacity=".9" />
        <Sparkle x={24} y={88} s={0.8} opacity=".7" />
        <Sparkle x={70} y={98} s={0.6} opacity=".6" />
      </svg>
      <span className="mt-0.5 text-sm font-extrabold tracking-wide" style={{ color: t.c2 }}>{nombre}</span>
    </div>
  );
}

export const TIER_COLORS = TIERS;
