"use client";

/**
 * Graphiques de l'admin aux couleurs Cotiz (vert #009E60, orange #F77F00).
 * Tous en SVG, sans bibliothèque : jauge à aiguille, montre, anneau,
 * pyramide (triangle), courbe remplie et colonnes.
 */
import { useId, useState } from "react";

export const VERT = "#009e60";
export const VERT_FONCE = "#005234";
export const ORANGE = "#f77f00";
export const VIOLET = "#7c3aed";

const pol = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
};
const arc = (cx: number, cy: number, r: number, de: number, a: number) => {
  const [x1, y1] = pol(cx, cy, r, de);
  const [x2, y2] = pol(cx, cy, r, a);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${a - de > 180 ? 1 : 0} 1 ${x2} ${y2}`;
};

/** Jauge en demi-cercle avec aiguille (compteur de vitesse) */
export function Jauge({ valeur, max = 100, unite = "%", label, sous, format }: { valeur: number; max?: number; unite?: string; label: string; sous?: string; format?: (n: number) => string }) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(max, valeur));
  const angle = -90 + (v / max) * 180;
  const graduations = Array.from({ length: 11 }, (_, k) => -90 + k * 18);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 122" className="w-full max-w-[230px]" role="img" aria-label={`${label} : ${valeur} ${unite}`}>
        <defs>
          <linearGradient id={`j${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={ORANGE} />
            <stop offset="0.5" stopColor="#f5c400" />
            <stop offset="1" stopColor={VERT} />
          </linearGradient>
        </defs>
        <path d={arc(100, 104, 80, -90, 90)} fill="none" stroke="#efeae4" strokeWidth="16" strokeLinecap="round" />
        <path d={arc(100, 104, 80, -90, 90)} fill="none" stroke={`url(#j${id})`} strokeWidth="16" strokeLinecap="round" opacity="0.95" />
        {graduations.map((g, k) => {
          const [x1, y1] = pol(100, 104, 62, g);
          const [x2, y2] = pol(100, 104, k % 5 === 0 ? 53 : 57, g);
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a8a29e" strokeWidth={k % 5 === 0 ? 2 : 1} strokeLinecap="round" />;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 104px", transition: "transform 1s cubic-bezier(.2,.9,.3,1.2)" }}>
          <path d="M 100 34 L 105 104 L 95 104 Z" fill={VERT_FONCE} />
        </g>
        <circle cx="100" cy="104" r="10" fill={VERT_FONCE} />
        <circle cx="100" cy="104" r="4" fill="#fff" />
        <text x="22" y="120" fontSize="9" fill="#78716c" textAnchor="middle">0</text>
        <text x="178" y="120" fontSize="9" fill="#78716c" textAnchor="middle">{format ? format(max) : max}</text>
      </svg>
      <p className="-mt-1 text-2xl font-extrabold tracking-tight text-stone-900">{format ? format(valeur) : `${valeur.toLocaleString("fr-FR")} ${unite}`}</p>
      <figcaption className="text-center text-sm font-semibold text-stone-700">{label}</figcaption>
      {sous && <p className="text-center text-xs text-stone-500">{sous}</p>}
    </figure>
  );
}

/** Montre : un cadran à 12 graduations, l'aiguille indique la part (0–100 %) */
export function Montre({ pourcent, label, sous }: { pourcent: number; label: string; sous?: string }) {
  const p = Math.max(0, Math.min(100, pourcent));
  const angle = (p / 100) * 360;
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 160 160" className="w-full max-w-[170px]" role="img" aria-label={`${label} : ${p} %`}>
        <circle cx="80" cy="80" r="74" fill={VERT_FONCE} />
        <circle cx="80" cy="80" r="66" fill="#fff" />
        {p > 0 && (p >= 100
          ? <circle cx="80" cy="80" r="58" fill="none" stroke={ORANGE} strokeOpacity="0.22" strokeWidth="16" />
          : <path d={`M 80 80 L 80 22 A 58 58 0 ${angle > 180 ? 1 : 0} 1 ${pol(80, 80, 58, angle)[0]} ${pol(80, 80, 58, angle)[1]} Z`} fill={ORANGE} fillOpacity="0.22" />)}
        {Array.from({ length: 12 }, (_, k) => {
          const [x1, y1] = pol(80, 80, 62, k * 30);
          const [x2, y2] = pol(80, 80, k % 3 === 0 ? 52 : 56, k * 30);
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={VERT_FONCE} strokeWidth={k % 3 === 0 ? 3 : 1.5} strokeLinecap="round" />;
        })}
        {[["0", 0], ["25", 90], ["50", 180], ["75", 270]].map(([t, a]) => {
          const [x, y] = pol(80, 80, 42, a as number);
          return <text key={t} x={x} y={y + 3.5} fontSize="10" fontWeight="700" fill="#57534e" textAnchor="middle">{t}</text>;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "80px 80px", transition: "transform 1.2s cubic-bezier(.2,.9,.3,1.2)" }}>
          <line x1="80" y1="88" x2="80" y2="26" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
        </g>
        <circle cx="80" cy="80" r="7" fill={ORANGE} />
        <circle cx="80" cy="80" r="2.5" fill="#fff" />
      </svg>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-stone-900">{p.toLocaleString("fr-FR")} %</p>
      <figcaption className="text-center text-sm font-semibold text-stone-700">{label}</figcaption>
      {sous && <p className="text-center text-xs text-stone-500">{sous}</p>}
    </figure>
  );
}

/** Anneau (donut) avec légende et survol */
export function Anneau({ parts, centre, sousCentre, format = (n) => n.toLocaleString("fr-FR") }: { parts: { label: string; n: number; couleur: string }[]; centre?: string; sousCentre?: string; format?: (n: number) => string }) {
  const [sel, setSel] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.n, 0);
  let cumul = 0;
  const visibles = parts.filter((p) => p.n > 0).length;
  const s = sel !== null ? parts[sel] : null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 160 160" className="w-40 shrink-0" role="img" aria-label={parts.map((p) => `${p.label} ${format(p.n)}`).join(", ")} onMouseLeave={() => setSel(null)}>
        <circle cx="80" cy="80" r="60" fill="none" stroke="#f1ede8" strokeWidth="22" />
        {total > 0 && parts.map((p, k) => {
          if (!p.n) return null;
          const de = (cumul / total) * 360; cumul += p.n;
          const a = (cumul / total) * 360;
          const ecart = visibles > 1 ? 1.4 : 0;
          if (visibles === 1) return <circle key={k} cx="80" cy="80" r="60" fill="none" stroke={p.couleur} strokeWidth={sel === k ? 26 : 22} onMouseEnter={() => setSel(k)} onClick={() => setSel(k)} />;
          return <path key={k} d={arc(80, 80, 60, de + ecart, a - ecart)} fill="none" stroke={p.couleur} strokeWidth={sel === k ? 26 : 22}
            opacity={sel === null || sel === k ? 1 : 0.45} className="cursor-pointer transition-all" onMouseEnter={() => setSel(k)} onClick={() => setSel(k)} />;
        })}
        <text x="80" y="78" textAnchor="middle" fontSize={(s ? format(s.n) : centre ?? format(total)).length > 9 ? 12.5 : (s ? format(s.n) : centre ?? format(total)).length > 7 ? 14.5 : 17} fontWeight="800" fill="#1c1917">{s ? format(s.n) : centre ?? format(total)}</text>
        <text x="80" y="95" textAnchor="middle" fontSize="9.5" fill="#78716c">{s ? `${s.label} · ${total ? Math.round((s.n / total) * 100) : 0} %` : sousCentre ?? "au total"}</text>
      </svg>
      <ul className="min-w-[150px] flex-1 space-y-2 text-sm">
        {parts.map((p, k) => (
          <li key={k} onMouseEnter={() => setSel(k)} onMouseLeave={() => setSel(null)} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${sel === k ? "bg-stone-100" : ""}`}>
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.couleur }} />
            <span className="flex-1 text-stone-700">{p.label}</span>
            <b className="text-stone-900">{format(p.n)}</b>
            <span className="w-10 text-right text-xs text-stone-500">{total ? Math.round((p.n / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pyramide (triangle) : étapes successives, du plus grand au plus petit */
export function Pyramide({ etages }: { etages: { label: string; n: number }[] }) {
  const tons = [VERT_FONCE, "#007a4b", VERT, "#3fbf8a", ORANGE];
  const h = 168, w = 220, n = etages.length;
  const haut = etages[0]?.n || 1;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-52 shrink-0" role="img" aria-label={etages.map((e) => `${e.label} ${e.n}`).join(", ")}>
        {etages.map((e, k) => {
          // Le triangle pointe vers le haut : la base (1er étage) est en bas
          const y2 = h - (k * h) / n, y1 = h - ((k + 1) * h) / n + 2;
          const demi = (y: number) => ((y / h) * w) / 2;
          const p = `${w / 2 - demi(y1)},${y1} ${w / 2 + demi(y1)},${y1} ${w / 2 + demi(y2)},${y2} ${w / 2 - demi(y2)},${y2}`;
          return (
            <g key={k}>
              <polygon points={p} fill={tons[k % tons.length]} />
              <text x={w / 2} y={(k === n - 1 ? y1 + (y2 - y1) * 0.72 : (y1 + y2) / 2) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">{e.n.toLocaleString("fr-FR")}</text>
            </g>
          );
        })}
      </svg>
      <ul className="min-w-[160px] flex-1 space-y-2 text-sm">
        {[...etages].map((e, k) => ({ e, k })).reverse().map(({ e, k }) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rotate-45 rounded-[2px]" style={{ background: tons[k % tons.length] }} />
            <span className="flex-1 text-stone-700">{e.label}</span>
            <b className="text-stone-900">{e.n.toLocaleString("fr-FR")}</b>
            <span className="w-10 text-right text-xs text-stone-500">{Math.round((e.n / haut) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Courbe lissée remplie d'un dégradé, avec repère au survol */
export function Courbe({ points, couleur = VERT, format = (n) => n.toLocaleString("fr-FR"), hauteur = 150 }: { points: { label: string; n: number }[]; couleur?: string; format?: (n: number) => string; hauteur?: number }) {
  const id = useId().replace(/:/g, "");
  const [sel, setSel] = useState<number | null>(null);
  const W = 600, H = hauteur, m = 8;
  const max = Math.max(1, ...points.map((p) => p.n));
  const pts = points.map((p, k) => [points.length === 1 ? W / 2 : m + (k * (W - 2 * m)) / (points.length - 1), H - 6 - (p.n / max) * (H - 24)] as const);
  let d = pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  for (let k = 1; k < pts.length; k++) {
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], cx = (x0 + x1) / 2;
    d += ` C ${cx} ${y0}, ${cx} ${y1}, ${x1} ${y1}`;
  }
  const aire = pts.length ? `${d} L ${pts[pts.length - 1][0]} ${H} L ${pts[0][0]} ${H} Z` : "";
  const s = sel !== null ? points[sel] : null;
  return (
    <div className="relative">
      <p className="mb-1 h-5 text-right text-xs font-semibold text-stone-700">{s ? `${s.label} : ${format(s.n)}` : <span className="font-normal text-stone-400">Passe le doigt sur la courbe</span>}</p>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[150px] w-full touch-none" onMouseLeave={() => setSel(null)}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; let best = 0; pts.forEach((p, k) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = k; }); setSel(best); }}>
        <defs>
          <linearGradient id={`c${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={couleur} stopOpacity="0.35" />
            <stop offset="1" stopColor={couleur} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e7e5e4" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
        <path d={aire} fill={`url(#c${id})`} />
        <path d={d} fill="none" stroke={couleur} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#d6d3d1" vectorEffect="non-scaling-stroke" />
        {sel !== null && <line x1={pts[sel][0]} x2={pts[sel][0]} y1="0" y2={H} stroke="#a8a29e" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {sel !== null && (
        <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${(pts[sel][0] / W) * 100}%`, top: `calc(20px + ${(pts[sel][1] / H) * 150}px)`, background: couleur }} />
      )}
      <div className="mt-1 flex justify-between text-[0.65rem] text-stone-400">
        <span>{points[0]?.label}</span><span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Colonnes verticales arrondies (distribution) */
export function Colonnes({ lignes, couleur = VERT }: { lignes: { label: string; n: number }[]; couleur?: string }) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  return (
    <div className="flex h-44 items-end gap-3 border-b border-stone-200 pt-5">
      {lignes.map((l, k) => (
        <div key={k} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${l.label} : ${l.n}`}>
          <span className="text-sm font-extrabold text-stone-900">{l.n}</span>
          <span className="block w-full max-w-[56px] rounded-t-xl transition-all" style={{ height: `${Math.max(3, (l.n / max) * 78)}%`, background: `linear-gradient(180deg, ${couleur}, ${couleur}bb)` }} />
          <span className="h-8 text-center text-[0.68rem] leading-tight text-stone-500">{l.label}</span>
        </div>
      ))}
    </div>
  );
}
