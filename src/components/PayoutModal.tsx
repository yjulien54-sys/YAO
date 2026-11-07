"use client";

import { useState } from "react";
import { fcfa } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments";
import type { PayoutMethod } from "@/lib/types";
import { Button, Field, inputClass } from "./ui";

const METHODES: PayoutMethod[] = ["wave", "orange", "mtn", "moov", "especes", "virement"];

/** Enregistrer un versement : l'argent sort de la caisse vers le bénéficiaire. */
export function PayoutModal({
  titre,
  beneficiaire,
  montant,
  max,
  nomModifiable,
  onClose,
  onConfirm,
}: {
  titre: string;
  beneficiaire: string;
  montant: number;
  max: number;
  nomModifiable?: boolean;
  onClose: () => void;
  onConfirm: (p: { beneficiaryName: string; amount: number; method: PayoutMethod; note?: string }) => Promise<void>;
}) {
  const [nom, setNom] = useState(beneficiaire);
  const [valeur, setValeur] = useState(String(Math.max(0, Math.round(montant))));
  const [methode, setMethode] = useState<PayoutMethod>("wave");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  const n = Number(valeur) || 0;

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h3 className="font-bold">{titre}</h3>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1 text-xl leading-none text-stone-400 hover:bg-stone-100">×</button>
        </div>
        <Field label="Bénéficiaire">
          <input className={inputClass} value={nom} onChange={(e) => setNom(e.target.value)} readOnly={!nomModifiable} />
        </Field>
        <Field label="Montant versé (F CFA)" hint={`Disponible dans la caisse : ${fcfa(max)} (frais Mobile Money déjà déduits)`}>
          <input className={`${inputClass} text-xl font-extrabold`} inputMode="numeric" value={valeur} onChange={(e) => setValeur(e.target.value.replace(/\D/g, ""))} />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-semibold text-stone-700">Envoyé par</p>
          <div className="flex flex-wrap gap-2">
            {METHODES.map((m) => (
              <button key={m} type="button" onClick={() => setMethode(m)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${methode === m ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-stone-700 ring-stone-300"}`}>
                {METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <Field label="Note (facultatif)">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : remis en main propre, réf. Wave…" />
        </Field>
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
          Envoie d’abord l’argent au bénéficiaire, puis confirme ici. Tout le groupe verra ce versement.
        </p>
        {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
        <Button
          className="w-full"
          disabled={busy || n <= 0 || n > max || !nom.trim()}
          onClick={async () => {
            setBusy(true);
            setErreur("");
            try {
              await onConfirm({ beneficiaryName: nom, amount: n, method: methode, note });
              onClose();
            } catch (e) {
              setErreur("Erreur : " + (e as Error).message);
              setBusy(false);
            }
          }}
        >
          {n > max ? "Montant supérieur à la caisse" : `Confirmer le versement de ${fcfa(n)}`}
        </Button>
      </div>
    </div>
  );
}
