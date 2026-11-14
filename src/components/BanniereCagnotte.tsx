"use client";

/** Sur la page d'une collecte : bannière bien visible pour publier ou partager la cagnotte publique */
import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Globe, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { messageCagnotte } from "@/lib/motif";

type EtatCagnotte = { slug: string | null; actif: boolean; vues: number; message: string | null };

/** État de la cagnotte publique d'une collecte (null si pas responsable ou pas encore la mise à jour) */
export function useCagnotte(groupId: string, gestionnaire: boolean) {
  const [etat, setEtat] = useState<EtatCagnotte | null | undefined>(undefined);
  useEffect(() => {
    if (!gestionnaire) return setEtat(null);
    supabase.rpc("cagnotte_etat", { g: groupId }).then(({ data, error }) => setEtat(error ? null : (data as EtatCagnotte)));
  }, [groupId, gestionnaire]);
  return etat;
}

/** Lien WhatsApp avec le message complet de la cagnotte (motif compris), ou null si elle n'est pas en ligne */
export function lienPartageCagnotte(etat: EtatCagnotte | null | undefined, nom: string, cause?: string | null) {
  if (!etat?.actif || !etat.slug) return null;
  const lien = `${window.location.origin}/c/${etat.slug}`;
  return `https://wa.me/?text=${encodeURIComponent(messageCagnotte({ nom, cause, message: etat.message, lien }))}`;
}

export function BanniereCagnotte({ groupId, nom, cause, gestionnaire, etat }: { groupId: string; nom: string; cause?: string | null; gestionnaire: boolean; etat: EtatCagnotte | null | undefined }) {
  if (!gestionnaire) return null;
  const wa = lienPartageCagnotte(etat, nom, cause);
  if (wa) {
    return (
      <div className="carte flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-white p-3.5 ring-1 ring-emerald-200">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><Globe size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-emerald-900">Ta cagnotte est en ligne</p>
          <p className="flex items-center gap-1 text-xs text-stone-600"><Eye size={12} /> {etat?.vues ?? 0} vue{(etat?.vues ?? 0) > 1 ? "s" : ""} · <Link href={`/groupes/${groupId}/parametres#cagnotte`} className="underline">modifier</Link></p>
        </div>
        <a href={wa} target="_blank" rel="noopener" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1fa855] px-3 py-2.5 text-sm font-bold text-white"><Share2 size={15} /> Partager</a>
      </div>
    );
  }
  return (
    <Link href={`/groupes/${groupId}/parametres#cagnotte`} className="carte relative block overflow-hidden bg-gradient-to-r from-orange-500 to-orange-600 p-4 text-white">
      <span className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
      <p className="relative text-lg font-extrabold">🌍 Publier la cagnotte sur une belle page</p>
      <p className="relative mt-0.5 text-sm text-orange-50">Photo, jauge de l’objectif et participants : envoie-la sur WhatsApp, même à ceux qui n’ont pas Cotiz.</p>
      <span className="relative mt-2 inline-block rounded-full bg-white px-3 py-1.5 text-sm font-extrabold text-orange-700">Créer la page →</span>
    </Link>
  );
}
