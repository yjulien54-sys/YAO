"use client";

import { useEffect, useRef, useState } from "react";

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Date valide ? (ex : pas de 31 février) */
function isoValide(j: string, m: string, a: string) {
  const jj = Number(j), mm = Number(m), aa = Number(a);
  if (!jj || !mm || a.length !== 4 || aa < 1900 || aa > new Date().getFullYear()) return "";
  const d = new Date(Date.UTC(aa, mm - 1, jj));
  if (d.getUTCFullYear() !== aa || d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== jj) return "";
  return `${a}-${String(mm).padStart(2, "0")}-${String(jj).padStart(2, "0")}`;
}

/**
 * Date de naissance sans calendrier : jour (2 chiffres), mois (liste), année (4 chiffres).
 * Renvoie la date au format AAAA-MM-JJ, ou "" tant qu'elle est incomplète ou impossible.
 */
export function DateNaissance({ value, onChange, className = "" }: { value: string; onChange: (iso: string) => void; className?: string }) {
  const [j, setJ] = useState(value ? String(Number(value.slice(8, 10))) : "");
  const [m, setM] = useState(value ? String(Number(value.slice(5, 7))) : "");
  const [a, setA] = useState(value ? value.slice(0, 4) : "");
  const refMois = useRef<HTMLSelectElement>(null);
  const refAnnee = useRef<HTMLInputElement>(null);

  // Valeur fournie de l'extérieur (ex : fiche chargée dans l'administration)
  useEffect(() => {
    if (value && value !== isoValide(j, m, a)) {
      setJ(String(Number(value.slice(8, 10))));
      setM(String(Number(value.slice(5, 7))));
      setA(value.slice(0, 4));
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const maj = (nj: string, nm: string, na: string) => onChange(isoValide(nj, nm, na));
  const incomplet = j !== "" && m !== "" && a.length === 4 && !isoValide(j, m, a);
  const champ = "w-full min-w-0 rounded-[14px] border bg-white px-2 py-3 text-base text-stone-900 outline-none transition focus:ring-4";
  const couleur = incomplet ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-stone-300/80 focus:border-emerald-500 focus:ring-emerald-100";

  return (
    <div className={className}>
      <div className="grid grid-cols-[3.6rem_1fr_5.2rem] gap-2">
        <input
          aria-label="Jour de naissance"
          placeholder="Jour"
          inputMode="numeric"
          autoComplete="bday-day"
          maxLength={2}
          value={j}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 2);
            setJ(v);
            maj(v, m, a);
            if (v.length === 2 || Number(v) > 3) refMois.current?.focus();
          }}
          className={`${champ} ${couleur} text-center`}
        />
        <select
          ref={refMois}
          aria-label="Mois de naissance"
          autoComplete="bday-month"
          value={m}
          onChange={(e) => {
            setM(e.target.value);
            maj(j, e.target.value, a);
            if (e.target.value) refAnnee.current?.focus();
          }}
          className={`${champ} ${couleur} !px-2 ${m ? "" : "text-stone-400"}`}
        >
          <option value="">Mois</option>
          {MOIS.map((nom, i) => (
            <option key={nom} value={String(i + 1)}>{String(i + 1).padStart(2, "0")} · {nom}</option>
          ))}
        </select>
        <input
          ref={refAnnee}
          aria-label="Année de naissance"
          placeholder="Année"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          value={a}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 4);
            setA(v);
            maj(j, m, v);
          }}
          className={`${champ} ${couleur} text-center`}
        />
      </div>
      {incomplet && <p className="mt-1 text-xs font-medium text-red-600">Cette date n’existe pas. Vérifie le jour, le mois et l’année.</p>}
    </div>
  );
}
