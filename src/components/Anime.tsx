"use client";

/** Chiffres qui défilent (compteurs animés), partout dans Cotiz */
import { useEffect, useRef, useState } from "react";

export const calme = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Compteur qui défile de l'ancienne valeur vers la nouvelle */
export function useCompte(cible: number, duree = 1100) {
  const [v, setV] = useState(calme() ? cible : 0);
  const depuis = useRef(0);
  useEffect(() => {
    if (calme()) { setV(cible); return; }
    const de = depuis.current, t0 = performance.now();
    let id = 0;
    const pas = (t: number) => {
      const k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
      const x = de + (cible - de) * e;
      setV(x); depuis.current = x;
      if (k < 1) id = requestAnimationFrame(pas);
    };
    id = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(id);
  }, [cible, duree]);
  return v;
}

/** Nombre animé, formaté à la française */
export function Nombre({ n, format = (x) => Math.round(x).toLocaleString("fr-FR"), duree }: { n: number; format?: (n: number) => string; duree?: number }) {
  const v = useCompte(n, duree);
  return <>{format(Number.isInteger(n) ? Math.round(v) : Math.round(v * 10) / 10)}</>;
}

/** Texte contenant un nombre (« 1 274 000 F », « 74 % ») : seul le nombre défile */
export function TexteAnime({ texte }: { texte: string }) {
  const m = texte.match(/\d[\d\s  ]*(?:[.,]\d+)?/);
  const brut = m ? m[0].replace(/[\s  ]/g, "").replace(",", ".") : "";
  const n = m ? Number(brut) : NaN;
  const v = useCompte(Number.isFinite(n) ? n : 0);
  if (!m || !Number.isFinite(n)) return <>{texte}</>;
  const dec = brut.includes(".") ? brut.split(".")[1].length : 0;
  // Même séparateur de milliers que le texte d'origine (espace normale ou insécable)
  const sep = m[0].match(/\d([\s\u202f\u00a0])\d/)?.[1] ?? "\u00a0";
  const [ent, frac] = v.toFixed(dec).split(".");
  const aff = ent.replace(/\B(?=(\d{3})+(?!\d))/g, sep) + (frac ? "," + frac : "");
  return <>{texte.slice(0, m.index)}{aff}{texte.slice((m.index ?? 0) + m[0].trimEnd().length)}</>;
}
