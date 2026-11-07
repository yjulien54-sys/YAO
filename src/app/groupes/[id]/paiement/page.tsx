"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Loading, Page, btnClass, useRequireUser } from "@/components/ui";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function SuiviPaiementPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Suivi />
    </Suspense>
  );
}

/** Après le paiement CinetPay : on attend la confirmation, puis on affiche le reçu. */
function Suivi() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const tx = useSearchParams().get("tx") ?? "";
  const router = useRouter();
  const { reload } = useStore();
  const [etat, setEtat] = useState<"attente" | "echec" | "long">("attente");

  useEffect(() => {
    if (!ok || !tx) return;
    let arret = false;
    let essais = 0;
    const verifier = async () => {
      if (arret) return;
      essais++;
      try {
        const { data } = await supabase.auth.getSession();
        const res = await fetch(`/api/paiements/statut?tx=${encodeURIComponent(tx)}`, {
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        });
        const json = await res.json();
        if (json.statut === "ACCEPTED" && json.paiements?.length) {
          await reload();
          const n = json.paiements.length;
          router.replace(`/groupes/${id}/recu/${json.paiements[0].id}?nouveau=1${n > 1 ? `&n=${n}` : ""}`);
          return;
        }
        if (json.statut === "REFUSED") return setEtat("echec");
      } catch {}
      if (essais >= 40) return setEtat("long");
      setTimeout(verifier, 3000);
    };
    verifier();
    return () => {
      arret = true;
    };
  }, [ok, tx, id, reload, router]);

  if (!ok) return <Loading />;

  return (
    <Page>
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div className="space-y-4">
          {etat === "attente" && (
            <>
              <div className="mx-auto h-14 w-14 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
              <h2 className="text-xl font-bold">Confirmation du paiement…</h2>
              <p className="text-sm text-stone-600">On attend la confirmation de l’opérateur. Ne ferme pas cette page.</p>
            </>
          )}
          {etat === "echec" && (
            <>
              <div className="text-5xl">❌</div>
              <h2 className="text-xl font-bold">Paiement non abouti</h2>
              <p className="text-sm text-stone-600">Aucun argent n’a été prélevé. Tu peux réessayer.</p>
              <Link href={`/groupes/${id}/payer`} className={btnClass("primary", "w-full")}>Réessayer</Link>
            </>
          )}
          {etat === "long" && (
            <>
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold">Confirmation en cours</h2>
              <p className="text-sm text-stone-600">L’opérateur n’a pas encore confirmé. Le groupe sera mis à jour automatiquement dès que ce sera fait.</p>
            </>
          )}
          <Link href={`/groupes/${id}`} className={btnClass("secondary", "w-full")}>Retour au groupe</Link>
        </div>
      </div>
    </Page>
  );
}
