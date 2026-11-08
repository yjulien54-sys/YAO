"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function SuppressionCompte() {
  const { ready, user, userId, logout } = useStore();
  const [etat, setEtat] = useState<"idle" | "busy" | "done" | "erreur">("idle");

  async function supprimer() {
    if (!userId || !confirm("Supprimer définitivement ton compte Cotiz ?")) return;
    setEtat("busy");
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (error) return setEtat("erreur");
    await logout();
    setEtat("done");
  }

  return (
    <main className="mx-auto min-h-dvh max-w-2xl bg-white px-5 py-8 text-base leading-relaxed text-stone-800">
      <Link href="/" className="text-sm font-semibold text-emerald-700">← Retour à Cotiz</Link>
      <h1 className="mt-4 text-2xl font-extrabold">Supprimer mon compte Cotiz</h1>
      <p className="mt-2">La suppression efface ton profil (nom et numéro de téléphone) et te déconnecte de l’application.</p>
      <p className="mt-2 text-sm text-stone-600">
        L’historique des paiements des groupes (montants, dates) est conservé pour la transparence de ces groupes : ton nom y reste associé tel que le trésorier l’a saisi. Tu peux demander au trésorier de te retirer de la liste des membres.
      </p>
      <div className="mt-6">
        {etat === "done" ? (
          <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800">Ton compte a été supprimé.</p>
        ) : ready && user ? (
          <Button onClick={supprimer} disabled={etat === "busy"} className="w-full !from-red-500 !to-red-700 !shadow-red-900/20">
            {etat === "busy" ? "Suppression…" : `Supprimer le compte de ${user.name}`}
          </Button>
        ) : (
          <p className="rounded-xl bg-stone-100 p-3 text-sm">
            Ouvre Cotiz, connecte-toi, puis reviens sur cette page pour supprimer ton compte. Tu peux aussi écrire à l’adresse e-mail indiquée sur la fiche de Cotiz dans Google Play.
          </p>
        )}
        {etat === "erreur" && <p className="mt-2 text-sm text-red-600">La suppression a échoué. Réessaie plus tard.</p>}
      </div>
    </main>
  );
}
