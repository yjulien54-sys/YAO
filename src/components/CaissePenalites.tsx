"use client";

import { useState } from "react";
import { HandHeart } from "lucide-react";
import { IconBadge } from "./icons";
import { PayoutModal } from "./PayoutModal";
import { Button } from "./ui";
import { dateCourte, fcfa } from "@/lib/format";
import { DESTINATION_PENALITES, NATURE_LABEL, caissePenalites, toujoursPonctuels } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Group, PayoutNature } from "@/lib/types";

/** Caisse des pénalités : solidarité, récompense ou don, visible par tous */
export function CaissePenalites({ g, tresorier }: { g: Group; tresorier: boolean }) {
  const { recordPayout } = useStore();
  const [ouvert, setOuvert] = useState(false);
  const cp = caissePenalites(g);
  if (!cp || g.type === "collecte" || g.penalty <= 0) return null;
  const dest = g.penaltyDestination;
  const nature: PayoutNature = dest === "don" ? "don" : dest === "recompense" ? "recompense" : "solidarite";
  const ponctuels = dest === "recompense" ? toujoursPonctuels(g) : [];
  const action = dest === "don" ? "Faire le don" : dest === "recompense" ? "Verser une récompense" : "Utiliser pour une aide";

  return (
    <div className="carte space-y-3 p-4">
      <div className="flex items-start gap-3">
        <IconBadge icon={HandHeart} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">Caisse des pénalités</p>
          <p className="text-xs text-stone-500">
            {DESTINATION_PENALITES[dest].titre}
            {dest === "don" && g.donCause ? ` : ${g.donCause}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-extrabold">{fcfa(cp.solde)}</p>
          <p className="text-[11px] text-stone-500">disponible</p>
        </div>
      </div>
      <p className="text-xs text-stone-600">
        {fcfa(cp.total)} de pénalités payées{cp.utilise > 0 ? ` · ${fcfa(cp.utilise)} déjà ${dest === "don" ? "offerts" : "utilisés"}` : ""}.
      </p>
      {dest === "recompense" && (
        <p className="text-xs text-stone-600">
          Toujours à l’heure pour l’instant : {ponctuels.length ? ponctuels.map((m) => m.name).join(", ") : "personne encore"}.
        </p>
      )}
      {cp.sorties.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-stone-50 p-3 text-xs ring-1 ring-stone-200">
          {cp.sorties.map((v) => (
            <li key={v.id} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{NATURE_LABEL[v.nature]} {v.beneficiaryName} · {dateCourte(v.date)}</span>
              <b className="shrink-0">{fcfa(v.amount)}</b>
            </li>
          ))}
        </ul>
      )}
      {tresorier && cp.solde > 0 && (
        <Button variant="secondary" className="w-full" onClick={() => setOuvert(true)}>
          {action}
        </Button>
      )}
      {ouvert && (
        <PayoutModal
          titre={action}
          beneficiaire={dest === "don" ? g.donCause ?? "" : ""}
          nomModifiable
          montant={cp.solde}
          max={cp.solde}
          onClose={() => setOuvert(false)}
          onConfirm={(v) => recordPayout(g.id, { ...v, round: g.currentRound, memberId: null, nature })}
        />
      )}
    </div>
  );
}
