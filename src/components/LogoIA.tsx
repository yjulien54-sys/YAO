/**
 * Logo de « Cotiz IA » : une bulle de discussion souriante dans un carré violet,
 * avec l'étincelle orange de Cotiz. Animé doucement (l'étincelle scintille).
 */
export function LogoIA({ taille = 44, anime = true, className = "" }: { taille?: number; anime?: boolean; className?: string }) {
  const id = "ia" + taille;
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" className={`shrink-0 ${className}`} role="img" aria-label="Cotiz IA">
      <defs>
        <linearGradient id={`${id}-fond`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="0.55" stopColor="#6d28d9" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
        <linearGradient id={`${id}-reflet`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}-etincelle`}>
          <stop offset="0" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#f77f00" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="18" fill={`url(#${id}-fond)`} />
      <path d="M2 20 Q2 2 20 2 H44 Q62 2 62 20 V26 Q32 34 2 26 Z" fill={`url(#${id}-reflet)`} />
      {/* bulle de discussion */}
      <path d="M17 22 h26 a7 7 0 0 1 7 7 v10 a7 7 0 0 1 -7 7 h-13 l-7 6 v-6 h-6 a7 7 0 0 1 -7 -7 v-10 a7 7 0 0 1 7 -7 z" fill="#fff" />
      {/* visage : deux yeux et un sourire */}
      <circle cx="24.5" cy="32" r="2.6" fill="#4338ca" />
      <circle cx="35.5" cy="32" r="2.6" fill="#4338ca" />
      <path d="M24 38 q6 4.5 12 0" fill="none" stroke="#009e60" strokeWidth="2.6" strokeLinecap="round" />
      {/* étincelle orange Cotiz */}
      <g className={anime ? "pulse-doux" : ""}>
        <path d="M50 8 l2.2 5.3 5.3 2.2 -5.3 2.2 -2.2 5.3 -2.2 -5.3 -5.3 -2.2 5.3 -2.2 z" fill={`url(#${id}-etincelle)`} />
      </g>
      <circle cx="13" cy="13" r="2" fill="#fff" opacity="0.7" />
    </svg>
  );
}
