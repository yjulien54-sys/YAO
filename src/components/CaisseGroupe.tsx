"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Landmark } from "lucide-react";
import { IconBadge } from "./icons";
import { fcfa } from "@/lib/format";
import { caisse, sum } from "@/lib/logic";
import type { Group } from "@/lib/types";

const CLE = "cotiz:montants-caches";

/** Caisse générale du groupe : somme totale cotisée, ta cotisation, versé, solde — avec un œil pour cacher les montants */
export function CaisseGroupe({ g, userId }: { g: Group; userId: string | null }) {
  const [cache, setCache] = useState(false);
  useEffect(() => {
    try { setCache(localStorage.getItem(CLE) === "1"); } catch {}
  }, []);
  const basculer = () => {
    setCache((c) => {
      try { localStorage.setItem(CLE, c ? "0" : "1"); } catch {}
      return !c;
    });
  };

  const cs = caisse(g);
  const mesParts = new Set(g.members.filter((m) => !!userId && m.profileId === userId).map((m) => m.id));
  const mesPaiements = g.payments.filter((p) => mesParts.has(p.memberId));
  const maCotisation = sum(mesPaiements);
  const part = cs.brut > 0 ? Math.round((maCotisation / cs.brut) * 100) : 0;
  const m = (n: number) => (cache ? "•••• F" : fcfa(n));

  return (
    <div className="carte overflow-hidden">
      <div className="flex items-center gap-3 p-4 pb-3">
        <IconBadge icon={Landmark} taille="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-[0.8rem] font-medium text-stone-500">Somme de la caisse</p>
          <p className="truncate text-2xl font-extrabold tracking-tight text-stone-900">{m(cs.brut)}</p>
        </div>
        <button
          type="button"
          onClick={basculer}
          aria-label={cache ? "Afficher les montants" : "Cacher les montants"}
          aria-pressed={cache}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200"
        >
          {cache ? <EyeOff size={19} strokeWidth={1.9} /> : <Eye size={19} strokeWidth={1.9} />}
        </button>
      </div>
      <p className="px-4 pb-3 text-xs text-stone-500">
        Tout ce que les membres ont cotisé depuis le début ({g.payments.length} paiement{g.payments.length > 1 ? "s" : ""} confirmé{g.payments.length > 1 ? "s" : ""}).
      </p>
      <dl className="grid grid-cols-2 border-t border-stone-200/80 text-sm">
        <div className="border-r border-stone-200/80 p-3">
          <dt className="text-xs text-stone-500">Ta cotisation</dt>
          <dd className="mt-0.5 font-bold text-emerald-800">{m(maCotisation)}</dd>
          {mesParts.size > 0 && !cache && cs.brut > 0 && <dd className="text-[0.7rem] text-stone-500">{part} % de la caisse</dd>}
        </div>
        <div className="p-3">
          <dt className="text-xs text-stone-500">Déjà versé</dt>
          <dd className="mt-0.5 font-bold text-stone-900">{m(cs.verse)}</dd>
          <dd className="text-[0.7rem] text-stone-500">{g.type === "tontine" ? "aux bénéficiaires" : "sorti de la caisse"}</dd>
        </div>
        <div className="col-span-2 border-t border-stone-200/80 p-3">
          <dt className="text-xs text-stone-500">Reste dans la caisse</dt>
          <dd className="mt-0.5 font-bold text-stone-900">{m(cs.solde)}</dd>
        </div>
      </dl>
    </div>
  );
}
