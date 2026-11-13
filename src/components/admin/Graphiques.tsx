"use client";

/**
 * Graphiques de l'admin aux couleurs Cotiz (vert #009E60, orange #F77F00).
 * Tous en SVG, sans bibliothèque : jauge à aiguille, montre, anneau,
 * pyramide (triangle), courbe remplie et colonnes — tous animés à l'ouverture
 * (désactivé si le téléphone demande « réduire les animations »).
 */
import { useEffect, useId, useState } from "react";
import { Nombre, TexteAnime } from "@/components/Anime";
export { Nombre, TexteAnime, useCompte } from "@/components/Anime";

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

/** Passe à true juste après l'affichage : déclenche les transitions CSS */
function useMonte() {
  const [ok, setOk] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => requestAnimationFrame(() => setOk(true))); return () => cancelAnimationFrame(t); }, []);
  return ok;
}

/** Jauge en demi-cercle avec aiguille (compteur de vitesse) */
export function Jauge({ valeur, max = 100, unite = "%", label, sous, format }: { valeur: number; max?: number; unite?: string; label: string; sous?: string; format?: (n: number) => string }) {
  const id = useId().replace(/:/g, "");
  const ok = useMonte();
  const v = Math.max(0, Math.min(max, valeur));
  const part = ok ? v / max : 0;
  const angle = -90 + part * 180;
  const [bx, by] = pol(100, 104, 80, angle);
  const graduations = Array.from({ length: 11 }, (_, k) => -90 + k * 18);
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 200 122" className="w-full max-w-[230px] overflow-visible" role="img" aria-label={`${label} : ${valeur} ${unite}`}>
        <defs>
          <linearGradient id={`j${id}`} gradientUnits="userSpaceOnUse" x1="20" x2="180" y1="0" y2="0">
            <stop offset="0" stopColor={ORANGE} />
            <stop offset="0.5" stopColor="#f5c400" />
            <stop offset="1" stopColor={VERT} />
          </linearGradient>
          <filter id={`g${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        <path d={arc(100, 104, 80, -90, 90)} fill="none" stroke="#efeae4" strokeWidth="16" strokeLinecap="round" />
        <path d={arc(100, 104, 80, -90, 90)} fill="none" stroke={`url(#j${id})`} strokeWidth="16" strokeLinecap="round" pathLength={100}
          strokeDasharray={`${part * 100} 100`} style={{ transition: "stroke-dasharray 1.4s cubic-bezier(.22,1,.36,1)" }} />
        {graduations.map((g, k) => {
          const [x1, y1] = pol(100, 104, 62, g);
          const [x2, y2] = pol(100, 104, k % 5 === 0 ? 53 : 57, g);
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a8a29e" strokeWidth={k % 5 === 0 ? 2 : 1} strokeLinecap="round" />;
        })}
        {v > 0 && <circle cx={bx} cy={by} r="7" fill="#fff" stroke={VERT_FONCE} strokeWidth="2" style={{ transition: "cx 1.4s cubic-bezier(.22,1,.36,1), cy 1.4s cubic-bezier(.22,1,.36,1)" }} />}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "100px 104px", transition: "transform 1.4s cubic-bezier(.3,1.5,.5,1)" }}>
          <path d="M 100 34 L 105 104 L 95 104 Z" fill={VERT_FONCE} opacity="0.25" filter={`url(#g${id})`} transform="translate(3 3)" />
          <path d="M 100 34 L 105 104 L 95 104 Z" fill={VERT_FONCE} />
        </g>
        <circle cx="100" cy="104" r="10" fill={VERT_FONCE} />
        <circle cx="100" cy="104" r="4" fill="#fff" />
        <text x="22" y="120" fontSize="9" fill="#78716c" textAnchor="middle">0</text>
        <text x="178" y="120" fontSize="9" fill="#78716c" textAnchor="middle">{format ? format(max) : max}</text>
      </svg>
      <p className="-mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-stone-900"><Nombre n={valeur} format={(x) => (format ? format(x) : `${x.toLocaleString("fr-FR")} ${unite}`)} /></p>
      <figcaption className="text-center text-sm font-semibold text-stone-700">{label}</figcaption>
      {sous && <p className="text-center text-xs text-stone-500">{sous}</p>}
    </figure>
  );
}

/** Montre : un cadran à 12 graduations, l'aiguille indique la part (0–100 %) */
export function Montre({ pourcent, label, sous }: { pourcent: number; label: string; sous?: string }) {
  const ok = useMonte();
  const p = Math.max(0, Math.min(100, pourcent));
  const vis = ok ? p : 0;
  const angle = (vis / 100) * 360;
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 160 160" className="w-full max-w-[170px]" role="img" aria-label={`${label} : ${p} %`}>
        <defs>
          <radialGradient id="cadran" cx="50%" cy="40%" r="60%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#f3f6f4" /></radialGradient>
        </defs>
        <circle cx="80" cy="80" r="76" fill={VERT_FONCE} />
        <circle cx="80" cy="80" r="76" fill="none" stroke={ORANGE} strokeWidth="2" strokeDasharray="2 6" opacity="0.6" />
        <circle cx="80" cy="80" r="66" fill="url(#cadran)" />
        {/* Part écoulée : un disque dessiné au trait (rayon 29, épaisseur 58) */}
        <circle cx="80" cy="80" r="29" fill="none" stroke={ORANGE} strokeOpacity="0.22" strokeWidth="58" pathLength={100}
          strokeDasharray={`${vis} 100`} transform="rotate(-90 80 80)" style={{ transition: "stroke-dasharray 1.5s cubic-bezier(.22,1,.36,1)" }} />
        {Array.from({ length: 60 }, (_, k) => {
          const grand = k % 5 === 0;
          const [x1, y1] = pol(80, 80, 63, k * 6);
          const [x2, y2] = pol(80, 80, grand ? (k % 15 === 0 ? 52 : 56) : 60, k * 6);
          return <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={VERT_FONCE} strokeWidth={k % 15 === 0 ? 3 : grand ? 1.6 : 0.6} strokeLinecap="round" opacity={grand ? 1 : 0.5} />;
        })}
        {[["0", 0], ["25", 90], ["50", 180], ["75", 270]].map(([t, a]) => {
          const [x, y] = pol(80, 80, 41, a as number);
          return <text key={t} x={x} y={y + 3.5} fontSize="10" fontWeight="700" fill="#57534e" textAnchor="middle">{t}</text>;
        })}
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: "80px 80px", transition: "transform 1.5s cubic-bezier(.3,1.45,.5,1)" }}>
          <line x1="80" y1="92" x2="80" y2="24" stroke={ORANGE} strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="30" r="3.5" fill={ORANGE} />
        </g>
        {/* trotteuse décorative qui tourne doucement */}
        <g className="aiguille-trotteuse" style={{ transformOrigin: "80px 80px" }}>
          <line x1="80" y1="84" x2="80" y2="20" stroke={VERT_FONCE} strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        </g>
        <circle cx="80" cy="80" r="7" fill={ORANGE} />
        <circle cx="80" cy="80" r="2.5" fill="#fff" />
      </svg>
      <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-stone-900"><Nombre n={p} format={(x) => `${x.toLocaleString("fr-FR")} %`} /></p>
      <figcaption className="text-center text-sm font-semibold text-stone-700">{label}</figcaption>
      {sous && <p className="text-center text-xs text-stone-500">{sous}</p>}
    </figure>
  );
}

/** Anneau (donut) avec légende et survol ; les parts se dessinent une à une */
export function Anneau({ parts, centre, sousCentre, format = (n) => n.toLocaleString("fr-FR") }: { parts: { label: string; n: number; couleur: string }[]; centre?: string; sousCentre?: string; format?: (n: number) => string }) {
  const [sel, setSel] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.n, 0);
  let cumul = 0;
  const visibles = parts.filter((p) => p.n > 0).length;
  const s = sel !== null ? parts[sel] : null;
  const texteCentre = s ? format(s.n) : centre ?? format(total);
  const taille = texteCentre.length > 9 ? 12.5 : texteCentre.length > 7 ? 14.5 : 17;
  let ordre = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 160 160" className="w-40 shrink-0" role="img" aria-label={parts.map((p) => `${p.label} ${format(p.n)}`).join(", ")} onMouseLeave={() => setSel(null)}>
        <circle cx="80" cy="80" r="60" fill="none" stroke="#f1ede8" strokeWidth="22" />
        <circle cx="80" cy="80" r="44" fill="none" stroke="#f5f2ee" strokeWidth="1" strokeDasharray="2 4" />
        {total > 0 && parts.map((p, k) => {
          if (!p.n) return null;
          const de = (cumul / total) * 360; cumul += p.n;
          const a = (cumul / total) * 360;
          const ecart = visibles > 1 ? 1.4 : 0;
          const delai = `${(ordre++) * 0.35}s`;
          const commun = { fill: "none", stroke: p.couleur, strokeWidth: sel === k ? 27 : 22, pathLength: 1, className: "trace cursor-pointer", onMouseEnter: () => setSel(k), onClick: () => setSel(sel === k ? null : k), style: { animationDelay: delai, transition: "stroke-width .25s, opacity .25s", opacity: sel === null || sel === k ? 1 : 0.4 } };
          if (visibles === 1) return <path key={k} d={`${arc(80, 80, 60, 0, 180)} ${arc(80, 80, 60, 180, 359.99).replace("M", "L")}`} {...commun} />;
          return <path key={k} d={arc(80, 80, 60, de + ecart, a - ecart)} {...commun} />;
        })}
        <text x="80" y="78" textAnchor="middle" fontSize={taille} fontWeight="800" fill="#1c1917" className="tabular-nums">{s ? texteCentre : <TexteAnime texte={texteCentre} />}</text>
        <text x="80" y="95" textAnchor="middle" fontSize="9.5" fill="#78716c">{s ? `${s.label} · ${total ? Math.round((s.n / total) * 100) : 0} %` : sousCentre ?? "au total"}</text>
      </svg>
      <ul className="min-w-[150px] flex-1 space-y-2 text-sm">
        {parts.map((p, k) => (
          <li key={k} onMouseEnter={() => setSel(k)} onMouseLeave={() => setSel(null)} className={`apparait flex items-center gap-2 rounded-lg px-2 py-1 transition-colors ${sel === k ? "bg-stone-100" : ""}`} style={{ animationDelay: `${0.2 + k * 0.12}s` }}>
            <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white shadow" style={{ background: p.couleur }} />
            <span className="flex-1 text-stone-700">{p.label}</span>
            <b className="tabular-nums text-stone-900"><TexteAnime texte={format(p.n)} /></b>
            <span className="w-10 text-right text-xs text-stone-500">{total ? Math.round((p.n / total) * 100) : 0} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pyramide (triangle) : étapes successives, du plus grand au plus petit ; elle se construit de bas en haut */
export function Pyramide({ etages }: { etages: { label: string; n: number }[] }) {
  const id = useId().replace(/:/g, "");
  const tons = [VERT_FONCE, "#007a4b", VERT, "#3fbf8a", ORANGE];
  const h = 168, w = 220, n = etages.length;
  const haut = etages[0]?.n || 1;
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <svg viewBox={`0 0 ${w} ${h + 4}`} className="w-52 shrink-0 overflow-visible" role="img" aria-label={etages.map((e) => `${e.label} ${e.n}`).join(", ")}>
        <defs>
          <linearGradient id={`p${id}`} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.18" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.12" /></linearGradient>
        </defs>
        <ellipse cx={w / 2} cy={h + 2} rx={w / 2} ry="4" fill="#000" opacity="0.08" />
        {etages.map((e, k) => {
          const y2 = h - (k * h) / n, y1 = h - ((k + 1) * h) / n + 2;
          const demi = (y: number) => ((y / h) * w) / 2;
          const p = `${w / 2 - demi(y1)},${y1} ${w / 2 + demi(y1)},${y1} ${w / 2 + demi(y2)},${y2} ${w / 2 - demi(y2)},${y2}`;
          return (
            <g key={k} className="apparait" style={{ animationDelay: `${k * 0.25}s` }}>
              <polygon points={p} fill={tons[k % tons.length]} />
              <polygon points={p} fill={`url(#p${id})`} />
              <text x={w / 2} y={(k === n - 1 ? y1 + (y2 - y1) * 0.72 : (y1 + y2) / 2) + 4} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff"><TexteAnime texte={e.n.toLocaleString("fr-FR")} /></text>
            </g>
          );
        })}
        <circle cx={w / 2} cy={2} r="3" fill={ORANGE} className="pulse-doux" />
      </svg>
      <ul className="min-w-[160px] flex-1 space-y-2 text-sm">
        {etages.map((e, k) => ({ e, k })).reverse().map(({ e, k }, i) => (
          <li key={k} className="apparait flex items-center gap-2" style={{ animationDelay: `${0.3 + i * 0.12}s` }}>
            <span className="h-3 w-3 shrink-0 rotate-45 rounded-[2px]" style={{ background: tons[k % tons.length] }} />
            <span className="flex-1 text-stone-700">{e.label}</span>
            <b className="tabular-nums text-stone-900">{e.n.toLocaleString("fr-FR")}</b>
            <span className="w-10 text-right text-xs text-stone-500">{Math.round((e.n / haut) * 100)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Courbe lissée remplie d'un dégradé, qui se trace de gauche à droite, avec repère au survol */
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
  const imax = points.reduce((b, p, k) => (p.n > points[b].n ? k : b), 0);
  const cle = points.map((p) => p.n).join(",");
  return (
    <div className="relative">
      <p className="mb-1 h-5 text-right text-xs font-semibold text-stone-700">{s ? `${s.label} : ${format(s.n)}` : <span className="font-normal text-stone-400">Passe le doigt sur la courbe</span>}</p>
      <svg key={cle} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[150px] w-full touch-none" onMouseLeave={() => setSel(null)}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; let best = 0; pts.forEach((p, k) => { if (Math.abs(p[0] - x) < Math.abs(pts[best][0] - x)) best = k; }); setSel(best); }}>
        <defs>
          <linearGradient id={`c${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={couleur} stopOpacity="0.4" />
            <stop offset="1" stopColor={couleur} stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id={`l${id}`} x1="0" x2="1">
            <stop offset="0" stopColor={couleur} stopOpacity="0.55" />
            <stop offset="1" stopColor={couleur} />
          </linearGradient>
        </defs>
        {[0.33, 0.66].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#e7e5e4" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />)}
        <path d={aire} fill={`url(#c${id})`} className="fondu" style={{ animationDelay: "0.6s" }} />
        <path d={d} fill="none" stroke={`url(#l${id})`} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" pathLength={1} className="trace" style={{ animationDuration: "1.6s" }} />
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#d6d3d1" vectorEffect="non-scaling-stroke" />
        {sel !== null && <line x1={pts[sel][0]} x2={pts[sel][0]} y1="0" y2={H} stroke="#a8a29e" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
      </svg>
      {/* point du record, qui pulse */}
      {pts.length > 1 && points[imax].n > 0 && sel === null && (
        <span className="fondu pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(pts[imax][0] / W) * 100}%`, top: `calc(24px + ${(pts[imax][1] / H) * 150}px)`, animationDelay: "1.5s" }}>
          <span className="onde absolute inset-0 rounded-full" style={{ background: couleur }} />
          <span className="relative block h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: couleur }} />
        </span>
      )}
      {sel !== null && (
        <span className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-all duration-150" style={{ left: `${(pts[sel][0] / W) * 100}%`, top: `calc(24px + ${(pts[sel][1] / H) * 150}px)`, background: couleur }} />
      )}
      <div className="mt-1 flex justify-between text-[0.65rem] text-stone-400">
        <span>{points[0]?.label}</span>
        {points[imax]?.n > 0 && <span className="font-semibold text-stone-500">Record : {format(points[imax].n)} ({points[imax].label})</span>}
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/** Colonnes verticales arrondies (distribution), qui poussent du sol */
export function Colonnes({ lignes, couleur = VERT }: { lignes: { label: string; n: number }[]; couleur?: string }) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  return (
    <div className="flex h-44 items-end gap-3 border-b border-stone-200 pt-5">
      {lignes.map((l, k) => (
        <div key={k} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${l.label} : ${l.n}`}>
          <span className="text-sm font-extrabold tabular-nums text-stone-900"><Nombre n={l.n} /></span>
          <span className="pousse block w-full max-w-[56px] rounded-t-xl shadow-sm transition group-hover:brightness-110" style={{ height: `${Math.max(3, (l.n / max) * 78)}%`, background: `linear-gradient(180deg, ${k === lignes.findIndex((x) => x.n === max) ? ORANGE : couleur}, ${k === lignes.findIndex((x) => x.n === max) ? ORANGE : couleur}aa)`, animationDelay: `${k * 0.12}s` }} />
          <span className="h-8 text-center text-[0.68rem] leading-tight text-stone-500">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

/* =====================================================================
   Graphiques originaux
   ===================================================================== */

/** Anneaux concentriques (façon montre de sport) : chaque anneau = une part de 0 à 100 % */
export function Anneaux({ anneaux, centre, sousCentre }: { anneaux: { label: string; pourcent: number; couleur: string; detail?: string }[]; centre?: string; sousCentre?: string }) {
  const ok = useMonte();
  const id = useId().replace(/:/g, "");
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <svg viewBox="0 0 180 180" className="w-44 shrink-0" role="img" aria-label={anneaux.map((a) => `${a.label} ${a.pourcent} %`).join(", ")}>
        <defs>
          {anneaux.map((a, k) => (
            <linearGradient key={k} id={`r${id}${k}`} x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor={a.couleur} stopOpacity="0.75" /><stop offset="1" stopColor={a.couleur} /></linearGradient>
          ))}
          <filter id={`o${id}`} x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" /></filter>
        </defs>
        {anneaux.map((a, k) => {
          const r = 78 - k * 19;
          const p = Math.max(0, Math.min(100, a.pourcent));
          return (
            <g key={k} transform="rotate(-90 90 90)">
              <circle cx="90" cy="90" r={r} fill="none" stroke={a.couleur} strokeOpacity="0.14" strokeWidth="14" />
              <circle cx="90" cy="90" r={r} fill="none" stroke={`url(#r${id}${k})`} strokeWidth="14" strokeLinecap="round" pathLength={100}
                strokeDasharray={`${ok ? Math.max(p, 0.5) : 0} 100`} filter={`url(#o${id})`}
                style={{ transition: `stroke-dasharray 1.6s cubic-bezier(.22,1,.36,1) ${k * 0.2}s` }} />
            </g>
          );
        })}
        {centre && <text x="90" y="92" textAnchor="middle" fontSize="16" fontWeight="800" fill="#1c1917">{centre}</text>}
        {sousCentre && <text x="90" y="106" textAnchor="middle" fontSize="8.5" fill="#78716c">{sousCentre}</text>}
      </svg>
      <ul className="min-w-[160px] flex-1 space-y-2.5 text-sm">
        {anneaux.map((a, k) => (
          <li key={k} className="apparait flex items-center gap-2.5" style={{ animationDelay: `${0.2 + k * 0.12}s` }}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full" style={{ background: `${a.couleur}22` }}><span className="h-2.5 w-2.5 rounded-full" style={{ background: a.couleur }} /></span>
            <span className="min-w-0 flex-1"><span className="block text-stone-700">{a.label}</span>{a.detail && <span className="block text-xs text-stone-500">{a.detail}</span>}</span>
            <b className="tabular-nums text-stone-900"><Nombre n={Math.round(a.pourcent)} format={(x) => `${x} %`} /></b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Calendrier de chaleur : une case par jour, plus c'est vert foncé plus il y a eu de monde */
export function Calendrier({ jours, format = (n) => `${n}` }: { jours: { jour: string; n: number }[]; format?: (n: number) => string }) {
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...jours.map((j) => j.n));
  const tons = ["#ecf7f1", "#bfe8d2", "#7fd1a8", "#2fb47a", VERT, VERT_FONCE];
  const ton = (n: number) => (n === 0 ? "#f1efec" : tons[Math.min(tons.length - 1, Math.ceil((n / max) * (tons.length - 1)))]);
  // On aligne sur les semaines (lundi en haut)
  const premier = jours.length ? (new Date(jours[0].jour + "T12:00:00").getDay() + 6) % 7 : 0;
  const cases: ({ jour: string; n: number; i: number } | null)[] = [...Array(premier).fill(null), ...jours.map((j, i) => ({ ...j, i }))];
  const semaines = Math.ceil(cases.length / 7);
  const s = sel !== null ? jours[sel] : null;
  const nomJour = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div>
      <p className="mb-2 h-5 text-xs font-semibold text-stone-700">{s ? `${nomJour(s.jour)} : ${format(s.n)}` : <span className="font-normal text-stone-400">Touche une case pour voir le jour</span>}</p>
      <div className="flex justify-center gap-2">
        <div className="grid gap-1 text-[0.6rem] leading-[22px] text-stone-400" style={{ gridTemplateRows: "repeat(7, 22px)" }}>{["L", "M", "M", "J", "V", "S", "D"].map((j, k) => <span key={k}>{j}</span>)}</div>
        <div className="grid grid-flow-col grid-rows-7 gap-1" style={{ gridTemplateColumns: `repeat(${semaines}, 22px)`, gridTemplateRows: "repeat(7, 22px)" }} onMouseLeave={() => setSel(null)}>
          {cases.map((c, k) => c ? (
            <button key={k} type="button" aria-label={`${c.jour} : ${c.n}`} onMouseEnter={() => setSel(c.i)} onClick={() => setSel(c.i)}
              className={`pop h-[22px] w-[22px] rounded-[6px] transition-transform hover:scale-125 ${sel === c.i ? "ring-2 ring-orange-500 ring-offset-1" : ""}`}
              style={{ background: ton(c.n), animationDelay: `${k * 18}ms` }} />
          ) : <span key={k} />)}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[0.65rem] text-stone-500">
        Moins {["#f1efec", ...tons].map((c) => <span key={c} className="h-3 w-3 rounded-[3px]" style={{ background: c }} />)} Plus
      </div>
    </div>
  );
}

/** Bocal de liquide : une vague qui monte jusqu'au pourcentage */
export function Vague({ pourcent, label, sous, couleur = VERT }: { pourcent: number; label: string; sous?: string; couleur?: string }) {
  const id = useId().replace(/:/g, "");
  const ok = useMonte();
  const p = Math.max(0, Math.min(100, pourcent));
  const niveau = 150 - (ok ? Math.max(p, 3) : 0) * 1.3; // de y=150 (vide) à y=20 (plein)
  const vague = "M0 0 Q 25 -9 50 0 T 100 0 T 150 0 T 200 0 T 250 0 T 300 0 V 200 H 0 Z";
  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 160 160" className="w-full max-w-[170px]" role="img" aria-label={`${label} : ${p} %`}>
        <defs>
          <clipPath id={`b${id}`}><circle cx="80" cy="80" r="66" /></clipPath>
          <linearGradient id={`v${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={couleur} stopOpacity="0.85" /><stop offset="1" stopColor={VERT_FONCE} /></linearGradient>
        </defs>
        <circle cx="80" cy="80" r="74" fill="none" stroke={couleur} strokeOpacity="0.25" strokeWidth="3" />
        <circle cx="80" cy="80" r="66" fill="#f3faf6" />
        <g clipPath={`url(#b${id})`}>
          <g style={{ transform: `translateY(${niveau}px)`, transition: "transform 1.8s cubic-bezier(.22,1,.36,1)" }}>
            <path d={vague} fill={couleur} opacity="0.35" className="vague-lente" />
            <path d={vague} fill={`url(#v${id})`} className="vague" transform="translate(0 4)" />
          </g>
        </g>
        <circle cx="58" cy="50" r="10" fill="#fff" opacity="0.35" />
        <text x="80" y="86" textAnchor="middle" fontSize="24" fontWeight="800" fill={p > 45 ? "#fff" : "#1c1917"} style={{ paintOrder: "stroke" }} stroke={p > 45 ? "rgba(0,0,0,0.12)" : "none"} strokeWidth="2"><Nombre n={p} format={(x) => `${x} %`} /></text>
      </svg>
      <figcaption className="mt-1 text-center text-sm font-semibold text-stone-700">{label}</figcaption>
      {sous && <p className="text-center text-xs text-stone-500">{sous}</p>}
    </figure>
  );
}

/** Horloge 24 h : une barre par heure de la journée, autour d'un cadran jour / nuit */
export function Horloge24({ heures, format = (n) => `${n}` }: { heures: number[]; format?: (n: number) => string }) {
  const ok = useMonte();
  const [sel, setSel] = useState<number | null>(null);
  const max = Math.max(1, ...heures);
  const top = heures.indexOf(Math.max(...heures));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 220" className="w-full max-w-[250px]" role="img" aria-label="Ouvertures selon l'heure de la journée" onMouseLeave={() => setSel(null)}>
        <defs>
          <radialGradient id="ciel" cx="50%" cy="30%" r="70%"><stop offset="0" stopColor="#fff8e6" /><stop offset="0.55" stopColor="#eaf6ff" /><stop offset="1" stopColor="#dbeefe" /></radialGradient>
        </defs>
        <circle cx="110" cy="110" r="52" fill="url(#ciel)" stroke="#e7e5e4" />
        {/* moitié nuit (18 h → 6 h) en bleu nuit léger */}
        <path d={`M 110 110 L ${pol(110, 110, 52, 270)[0]} ${pol(110, 110, 52, 270)[1]} A 52 52 0 0 1 ${pol(110, 110, 52, 90)[0]} ${pol(110, 110, 52, 90)[1]} Z`} fill="#1e3a5f" opacity="0.08" transform="rotate(180 110 110)" />
        {heures.map((n, h) => {
          const a = h * 15;
          const long = ok ? 6 + (n / max) * 46 : 0;
          const [x1, y1] = pol(110, 110, 56, a);
          const [x2, y2] = pol(110, 110, 56 + long, a);
          const nuit = h < 6 || h >= 19;
          return (
            <g key={h} onMouseEnter={() => setSel(h)} onClick={() => setSel(h)} className="cursor-pointer">
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={h === top ? ORANGE : nuit ? "#2c5f8a" : VERT} strokeWidth={sel === h ? 9 : 7} strokeLinecap="round"
                opacity={sel === null || sel === h ? 1 : 0.45} style={{ transition: `all 1.1s cubic-bezier(.22,1,.36,1) ${h * 25}ms` }} />
              <line x1={pol(110, 110, 50, a)[0]} y1={pol(110, 110, 50, a)[1]} x2={pol(110, 110, 104, a)[0]} y2={pol(110, 110, 104, a)[1]} stroke="transparent" strokeWidth="12" />
            </g>
          );
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = pol(110, 110, 40, h * 15);
          return <text key={h} x={x} y={y + 3} textAnchor="middle" fontSize="9" fontWeight="700" fill="#57534e">{h} h</text>;
        })}
        <text x="110" y="104" textAnchor="middle" fontSize="15">{sel !== null ? (sel < 6 || sel >= 19 ? "🌙" : "☀️") : "🕐"}</text>
        <text x="110" y="121" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1c1917">{sel !== null ? `${sel} h – ${sel + 1} h` : `Pic : ${top} h`}</text>
        <text x="110" y="133" textAnchor="middle" fontSize="8.5" fill="#78716c">{sel !== null ? format(heures[sel]) : format(heures[top])}</text>
      </svg>
      <p className="mt-1 flex flex-wrap justify-center gap-3 text-[0.7rem] text-stone-500">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: VERT }} /> journée</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#2c5f8a]" /> soir et nuit</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: ORANGE }} /> heure de pointe</span>
      </p>
    </div>
  );
}

/** Toile d'araignée (radar) : plusieurs notes de 0 à 100 sur une même figure */
export function Radar({ axes, couleur = VERT }: { axes: { label: string; pourcent: number }[]; couleur?: string }) {
  const ok = useMonte();
  const n = axes.length, c = 110, R = 72;
  const pt = (k: number, f: number) => pol(c, c, R * f, (k * 360) / n);
  const forme = axes.map((a, k) => pt(k, ok ? Math.max(0.04, Math.min(100, a.pourcent) / 100) : 0.02).join(",")).join(" ");
  const moy = Math.round(axes.reduce((s, a) => s + a.pourcent, 0) / Math.max(1, n));
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 220 220" className="w-full max-w-[270px] overflow-visible" role="img" aria-label={axes.map((a) => `${a.label} ${a.pourcent} %`).join(", ")}>
        <defs><radialGradient id="toile"><stop offset="0" stopColor={couleur} stopOpacity="0.45" /><stop offset="1" stopColor={ORANGE} stopOpacity="0.35" /></radialGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((f) => <polygon key={f} points={axes.map((_, k) => pt(k, f).join(",")).join(" ")} fill={f === 1 ? "#f6fbf8" : "none"} stroke="#e2e8e4" strokeDasharray={f === 1 ? "" : "3 3"} />)}
        {axes.map((_, k) => <line key={k} x1={c} y1={c} x2={pt(k, 1)[0]} y2={pt(k, 1)[1]} stroke="#e2e8e4" />)}
        <polygon points={forme} fill="url(#toile)" stroke={couleur} strokeWidth="2.5" strokeLinejoin="round" style={{ transition: "all 1.4s cubic-bezier(.3,1.4,.5,1)" }} />
        {axes.map((a, k) => {
          const [x, y] = pt(k, ok ? Math.max(0.04, Math.min(100, a.pourcent) / 100) : 0.02);
          const [lx, ly] = pt(k, 1.27);
          return (
            <g key={k}>
              <circle cx={x} cy={y} r="4" fill="#fff" stroke={couleur} strokeWidth="2.5" style={{ transition: "all 1.4s cubic-bezier(.3,1.4,.5,1)" }} />
              <text x={lx} y={ly - 2} textAnchor="middle" fontSize="8.5" fill="#57534e">{a.label}</text>
              <text x={lx} y={ly + 9} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#1c1917">{Math.round(a.pourcent)} %</text>
            </g>
          );
        })}
        <text x={c} y={c + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill={VERT_FONCE}>{moy}</text>
      </svg>
      <p className="text-xs text-stone-500">Note moyenne : <b className="text-stone-800">{moy} / 100</b></p>
    </div>
  );
}

/** Gaufre : 100 petits carrés, chaque carré = 1 % */
export function Gaufre({ parts }: { parts: { label: string; pourcent: number; couleur: string }[] }) {
  const cases: string[] = [];
  parts.forEach((p) => { for (let k = 0; k < Math.round(p.pourcent) && cases.length < 100; k++) cases.push(p.couleur); });
  while (cases.length < 100) cases.push("#ece9e4");
  return (
    <div className="flex flex-wrap items-center justify-center gap-5">
      <div className="grid w-40 shrink-0 grid-cols-10 gap-[3px]">
        {cases.map((c, k) => <span key={k} className="pop aspect-square rounded-[3px]" style={{ background: c, animationDelay: `${(k % 10) * 25 + Math.floor(k / 10) * 25}ms` }} />)}
      </div>
      <ul className="min-w-[150px] flex-1 space-y-2 text-sm">
        {parts.map((p, k) => (
          <li key={k} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: p.couleur }} />
            <span className="flex-1 text-stone-700">{p.label}</span>
            <b className="tabular-nums text-stone-900"><Nombre n={Math.round(p.pourcent)} format={(x) => `${x} %`} /></b>
          </li>
        ))}
        <li className="text-xs text-stone-500">1 carré = 1 %</li>
      </ul>
    </div>
  );
}
