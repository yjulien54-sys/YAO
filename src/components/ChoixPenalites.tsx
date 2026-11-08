"use client";

import { DESTINATION_PENALITES } from "@/lib/logic";
import type { PenaltyDestination } from "@/lib/types";
import { Field, inputClass } from "./ui";

/** Choix de l'utilisation des pénalités de retard */
export function ChoixPenalites({
  valeur,
  cause,
  onChange,
  onCause,
  disabled,
}: {
  valeur: PenaltyDestination;
  cause: string;
  onChange: (v: PenaltyDestination) => void;
  onCause: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      {(Object.keys(DESTINATION_PENALITES) as PenaltyDestination[]).map((v) => (
        <label key={v} className={`flex cursor-pointer gap-3 rounded-2xl border-2 p-3 transition ${valeur === v ? "border-emerald-500 bg-emerald-50/50" : "border-stone-200 bg-white"}`}>
          <input type="radio" name="penalites" checked={valeur === v} disabled={disabled} onChange={() => onChange(v)} className="mt-1 h-4 w-4 accent-emerald-600" />
          <span>
            <span className="block text-sm font-bold">{DESTINATION_PENALITES[v].titre}</span>
            <span className="block text-xs text-stone-500">{DESTINATION_PENALITES[v].desc}</span>
          </span>
        </label>
      ))}
      {valeur === "don" && (
        <Field label="Cause soutenue" hint="Le trésorier remettra le don et l’enregistrera : tout le groupe le verra.">
          <input className={inputClass} value={cause} disabled={disabled} onChange={(e) => onCause(e.target.value)} placeholder="ex : Orphelinat de Bingerville" />
        </Field>
      )}
    </div>
  );
}
