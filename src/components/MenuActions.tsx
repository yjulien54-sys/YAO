"use client";

/** Menu qui monte du bas de l'écran (après un appui long) : Copier, Sélectionner, Supprimer… */
import type { LucideIcon } from "lucide-react";

export type Action = { label: string; icone: LucideIcon; onClick: () => void; danger?: boolean; desactive?: boolean; note?: string };

export function MenuActions({ titre, apercu, actions, fermer }: { titre?: string; apercu?: string; actions: Action[]; fermer: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px] lg:items-center" onClick={fermer}>
      <div className="feuille w-full max-w-md rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        {(titre || apercu) && (
          <div className="mb-2 rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-100">
            {titre && <p className="text-sm font-bold text-stone-900">{titre}</p>}
            {apercu && <p className="mt-0.5 line-clamp-3 text-sm text-stone-600">{apercu}</p>}
          </div>
        )}
        <div className="divide-y divide-stone-100">
          {actions.map((a) => (
            <button key={a.label} type="button" disabled={a.desactive} onClick={() => { fermer(); a.onClick(); }}
              className={`flex w-full items-center gap-3 px-2 py-3.5 text-left text-[0.95rem] font-semibold transition active:bg-stone-50 disabled:opacity-40 ${a.danger ? "!text-red-600" : "text-stone-800"}`}>
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${a.danger ? "bg-red-50 text-red-600" : "bg-stone-100"}`}><a.icone size={18} /></span>
              <span className="min-w-0 flex-1">{a.label}{a.note && <span className="block text-xs font-normal text-stone-500">{a.note}</span>}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={fermer} className="mt-2 w-full rounded-2xl bg-stone-100 py-3 text-sm font-bold text-stone-700">Annuler</button>
      </div>
    </div>
  );
}

/** Barre affichée en mode « sélection » (plusieurs éléments à supprimer d'un coup) */
export function BarreSelection({ nombre, total, toutSelectionner, supprimer, annuler }: { nombre: number; total: number; toutSelectionner: () => void; supprimer: () => void; annuler: () => void }) {
  return (
    <div className="sticky top-0 z-20 -mx-1 mb-2 flex items-center gap-2 rounded-2xl bg-[#0b3d2c] px-3 py-2.5 text-white shadow-lg">
      <button type="button" onClick={annuler} className="rounded-full px-2 py-1 text-sm font-bold text-emerald-100">✕</button>
      <p className="flex-1 text-sm font-bold">{nombre} sélectionné{nombre > 1 ? "s" : ""}</p>
      {nombre < total && <button type="button" onClick={toutSelectionner} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">Tout</button>}
      <button type="button" disabled={!nombre} onClick={supprimer} className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Supprimer</button>
    </div>
  );
}
