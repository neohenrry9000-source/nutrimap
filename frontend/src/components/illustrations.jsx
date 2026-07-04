// Ilustraciones SVG propias, ligeras (~2 KB) y coherentes con la
// identidad de NutriMap (verde/territorio/cuidado). Funcionan en tema
// claro y oscuro usando opacidades sobre acentos fijos.

export function MapSearchIllustration({ className = "" }) {
  // Mapa plegado con pin y lupa: para estados vacíos de búsqueda.
  return (
    <svg viewBox="0 0 200 140" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="ill-map" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="ill-pin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* sombra base */}
      <ellipse cx="100" cy="126" rx="62" ry="8" fill="currentColor" opacity=".08" />
      {/* mapa plegado */}
      <g opacity=".92">
        <path d="M40 40 L74 30 L106 40 L140 30 L140 96 L106 106 L74 96 L40 106 Z"
              fill="url(#ill-map)" opacity=".16" />
        <path d="M40 40 L74 30 L106 40 L140 30 L140 96 L106 106 L74 96 L40 106 Z"
              fill="none" stroke="url(#ill-map)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M74 30 V96 M106 40 V106" stroke="url(#ill-map)" strokeWidth="1.5" opacity=".45" />
        {/* ruta punteada */}
        <path d="M54 78 Q 74 58 96 66 T 128 52" fill="none" stroke="#f59e0b"
              strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />
      </g>
      {/* pin con corazón */}
      <g>
        <path d="M96 24 c-11 0 -19 8.5 -19 19 c0 13 19 30 19 30 s19 -17 19 -30 c0 -10.5 -8 -19 -19 -19Z"
              fill="url(#ill-pin)" />
        <path d="M96 36.5 c-1.8 -2.2 -5.4 -2.4 -7.2 -.3 c-1.6 1.9 -1.4 4.8 .3 6.6 l6.9 6.6 l6.9 -6.6 c1.7 -1.8 1.9 -4.7 .3 -6.6 c-1.8 -2.1 -5.4 -1.9 -7.2 .3Z"
              fill="#fff" />
      </g>
      {/* lupa */}
      <g>
        <circle cx="142" cy="88" r="17" fill="#fff" fillOpacity=".75" stroke="#0ea5e9" strokeWidth="3.5" />
        <circle cx="142" cy="88" r="17" fill="none" stroke="#0ea5e9" strokeWidth="3.5" />
        <line x1="155" y1="101" x2="168" y2="114" stroke="#0ea5e9" strokeWidth="5" strokeLinecap="round" />
        <path d="M134 86 a9 9 0 0 1 8 -7" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function CommunityIllustration({ className = "" }) {
  // Olla común humeante sobre colinas: para el login y estados de apoyo.
  return (
    <svg viewBox="0 0 220 170" className={className} role="img" aria-hidden="true">
      <defs>
        <linearGradient id="ill-hill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
        <linearGradient id="ill-olla" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* sol */}
      <circle cx="178" cy="34" r="16" fill="#fbbf24" opacity=".9" />
      <circle cx="178" cy="34" r="24" fill="#fbbf24" opacity=".2" />
      {/* colinas */}
      <path d="M0 122 Q 55 84 110 116 T 220 108 V170 H0 Z" fill="url(#ill-hill)" opacity=".28" />
      <path d="M0 138 Q 70 104 140 132 T 220 126 V170 H0 Z" fill="url(#ill-hill)" opacity=".5" />
      {/* vapor */}
      <g stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7">
        <path d="M96 62 q -4 -8 2 -14 q 6 -6 2 -14" />
        <path d="M110 58 q -4 -8 2 -14 q 6 -6 2 -14" />
        <path d="M124 62 q -4 -8 2 -14 q 6 -6 2 -14" />
      </g>
      {/* olla */}
      <g>
        <rect x="78" y="66" width="64" height="10" rx="5" fill="url(#ill-olla)" />
        <path d="M82 76 h56 v18 a28 22 0 0 1 -56 0 Z" fill="url(#ill-olla)" />
        <path d="M70 80 q -8 4 0 10 M150 80 q 8 4 0 10" stroke="url(#ill-olla)" strokeWidth="5" fill="none" strokeLinecap="round" />
        {/* corazón en la olla */}
        <path d="M110 88 c-2 -2.5 -6 -2.7 -8 -.4 c-1.8 2.1 -1.6 5.3 .4 7.3 l7.6 7.3 l7.6 -7.3 c2 -2 2.2 -5.2 .4 -7.3 c-2 -2.3 -6 -2.1 -8 .4Z"
              fill="#34d399" />
      </g>
    </svg>
  );
}
