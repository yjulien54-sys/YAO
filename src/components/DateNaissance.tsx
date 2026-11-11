"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const CETTE_ANNEE = new Date().getFullYear();
const JOURS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const ANNEES = Array.from({ length: CETTE_ANNEE - 1919 }, (_, i) => String(CETTE_ANNEE - i)); // de cette année à 1920

/** Date valide ? (ex : pas de 31 février) */
function isoValide(j: string, m: string, a: string) {
  const jj = Number(j), mm = Number(m), aa = Number(a);
  if (!jj || !mm || a.length !== 4 || aa < 1900 || aa > CETTE_ANNEE) return "";
  const d = new Date(Date.UTC(aa, mm - 1, jj));
  if (d.getUTCFullYear() !== aa || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== jj) return "";
  return `${a}-${String(mm).padStart(2, "0")}-${String(jj).padStart(2, "0")}`;
}

/**
 * Date de naissance sans calendrier : trois listes déroulantes (jour, mois, année).
 * Renvoie la date au format AAAA-MM-JJ, ou "" tant qu'elle est incomplète ou impossible.
 */
export function DateNaissance({ value, onChange, className = "" }: { value: string; onChange: (iso: string) => void; className?: string }) {
  const [j, setJ] = useState(value ? String(Number(value.slice(8, 10))) : "");
  const [m, setM] = useState(value ? String(Number(value.slice(5, 7))) : "");
  const [a, setA] = useState(value ? value.slice(0, 4) : "");

  // Valeur fournie de l'extérieur (ex : fiche chargée dans l'administration)
  useEffect(() => {
    if (value && value !== isoValide(j, m, a)) {
      setJ(String(Number(value.slice(8, 10))));
      setM(String(Number(value.slice(5, 7))));
      setA(value.slice(0, 4));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (nj: string, nm: string, na: string) => onChange(isoValide(nj, nm, na));
  const impossible = j !== "" && m !== "" && a !== "" && !isoValide(j, m, a);
  const champ = "w-full min-w-0 appearance-none rounded-[14px] border bg-white pl-2 pr-6 py-3 text-center text-base outline-none transition focus:ring-4";
  const couleur = impossible ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-stone-300/80 focus:border-emerald-500 focus:ring-emerald-100";
  const teinte = (v: string) => (v ? "text-stone-900" : "text-stone-400");

  return (
    <div className={className}>
      <div className="grid grid-cols-[4.2rem_1fr_5.6rem] gap-2">
        <div className="relative">
        <select aria-label="Jour de naissance" autoComplete="bday-day" value={j}
          onChange={(e) => { setJ(e.target.value); maj(e.target.value, m, a); }}
          className={`${champ} ${couleur} ${teinte(j)}`}>
          <option value="">Jour</option>
          {JOURS.map((d) => <option key={d} value={d}>{d.padStart(2, "0")}</option>)}
        </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        </div>
        <div className="relative">
        <select aria-label="Mois de naissance" autoComplete="bday-month" value={m}
          onChange={(e) => { setM(e.target.value); maj(j, e.target.value, a); }}
          className={`${champ} ${couleur} ${teinte(m)}`}>
          <option value="">Mois</option>
          {MOIS.map((nom, i) => <option key={nom} value={String(i + 1)}>{String(i + 1).padStart(2, "0")} · {nom}</option>)}
        </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        </div>
        <div className="relative">
        <select aria-label="Année de naissance" autoComplete="bday-year" value={a}
          onChange={(e) => { setA(e.target.value); maj(j, m, e.target.value); }}
          className={`${champ} ${couleur} ${teinte(a)}`}>
          <option value="">Année</option>
          {ANNEES.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        </div>
      </div>
      {impossible && <p className="mt-1 text-xs font-medium text-red-600">Cette date n’existe pas. Vérifie le jour, le mois et l’année.</p>}
    </div>
  );
}
