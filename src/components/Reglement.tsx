"use client";

import { useState } from "react";
import { FileSignature } from "lucide-react";
import { IconBadge } from "./icons";
import { Button } from "./ui";
import { dateLongue } from "@/lib/format";
import { texteReglement } from "@/lib/logic";
import { useStore } from "@/lib/store";
import type { Group, Member } from "@/lib/types";

/** Carte « Signer le règlement » : engagement à payer jusqu'à la fin */
export function Reglement({ g, mesParts }: { g: Group; mesParts: Member[] }) {
  const { user, userId, accepterReglement } = useStore();
  const [ouvert, setOuvert] = useState(false);
  const [coche, setCoche] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState("");
  if (g.type === "collecte" || !user || !userId || mesParts.length === 0) return null;
  const signe = g.engagements.find((e) => e.profileId === userId);

  if (signe)
    return (
      <p className="flex items-center gap-2 px-1 text-xs text-stone-500">
        <FileSignature size={14} strokeWidth={1.9} className="text-emerald-700" />
        Tu as accepté le règlement le {dateLongue(signe.acceptedAt)}.
      </p>
    );

  const texte = texteReglement(g, user.name, user.phone, mesParts);
  return (
    <>
      <div className="carte flex items-center gap-3 border-amber-300 bg-amber-50/70 p-4">
        <IconBadge icon={FileSignature} ton="ambre" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Accepte le règlement du groupe</p>
          <p className="text-xs text-stone-600">Ton engagement protège tout le groupe.</p>
        </div>
        <Button className="shrink-0 !px-3 !py-2" onClick={() => setOuvert(true)}>Lire</Button>
      </div>

      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setOuvert(false)}>
          <div className="max-h-[92dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <IconBadge icon={FileSignature} />
              <h3 className="text-lg font-extrabold">Règlement du groupe</h3>
            </div>
            <div className="whitespace-pre-line rounded-2xl bg-stone-50 p-4 text-sm leading-relaxed text-stone-800 ring-1 ring-stone-200">{texte}</div>
            <label className="flex gap-3 text-sm">
              <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-emerald-600" />
              <span>J’ai lu le règlement et je m’engage à le respecter. Mon accord est enregistré avec la date et l’heure.</span>
            </label>
            {erreur && <p className="text-sm text-red-600">{erreur}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setOuvert(false)}>Plus tard</Button>
              <Button
                disabled={!coche || busy}
                onClick={async () => {
                  setBusy(true);
                  setErreur("");
                  try {
                    await accepterReglement(g.id, texte);
                    setOuvert(false);
                  } catch (e) {
                    setErreur("Impossible d’enregistrer : " + (e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                J’accepte
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
