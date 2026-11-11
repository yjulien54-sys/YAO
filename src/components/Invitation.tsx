"use client";

import { useEffect, useState } from "react";
import { Clock, HeartHandshake } from "lucide-react";
import { IconBadge } from "./icons";
import { Button, Header, Loading, Page } from "./ui";
import { supabase } from "@/lib/supabase";

/** Page d'invitation : affichée quand on ouvre le lien d'un groupe dont on n'est pas encore membre */
const TYPE_NOM: Record<string, string> = { tontine: "la tontine", association: "l’association", collecte: "la collecte" };

export function Invitation({ id, onJoin }: { id: string; onJoin: (inv: { cle?: string | null; par?: string | null }) => Promise<string | void> }) {
  const [info, setInfo] = useState<{ name: string; type: string; members_count: number } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [attente, setAttente] = useState(false);
  // Lien reçu : ?i=… (créateur ou trésorier : entrée directe) ou ?par=… (invité par un membre)
  const [inv, setInv] = useState<{ cle?: string | null; par?: string | null }>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setInv({ cle: q.get("i"), par: q.get("par") });
  }, []);

  useEffect(() => {
    supabase.rpc("group_preview", { g: id }).then(({ data }) => setInfo(data?.[0] ?? null));
    // Demande déjà envoyée ? (mise à jour SQL n°11)
    supabase.rpc("etat_adhesion", { g: id }).then(({ data, error }) => !error && data === "en_attente" && setAttente(true));
  }, [id]);

  if (info === undefined) return <Loading />;
  if (info === null)
    return (
      <Page>
        <Header back="/groupes" title="Groupe introuvable" />
        <p className="p-6 text-center text-stone-500">Ce groupe n’existe pas ou a été supprimé.</p>
      </Page>
    );

  return (
    <Page>
      <Header back="/groupes" title="Invitation" />
      <div className="space-y-5 p-6 text-center">
        <IconBadge icon={HeartHandshake} taille="xl" className="mx-auto" />
        <div>
          <p className="text-sm text-stone-500">Tu es invité(e) à rejoindre {TYPE_NOM[info.type] ?? "le groupe"}</p>
          <h2 className="mt-1 text-2xl font-extrabold">{info.name}</h2>
          <p className="mt-1 text-sm text-stone-500">{info.members_count} membre(s)</p>
        </div>
        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
        {attente ? (
          <div className="carte space-y-2 p-4 text-left">
            <p className="flex items-center gap-2 font-bold text-amber-800"><Clock size={18} strokeWidth={2} /> Demande envoyée</p>
            <p className="text-sm text-stone-600">Tu as été invité(e) par un membre : le créateur ou le trésorier du groupe doit accepter ta demande. Tu verras le groupe dans tes groupes dès qu’elle sera acceptée.</p>
            <p className="text-sm text-stone-600">Tu peux le prévenir sur WhatsApp pour aller plus vite.</p>
          </div>
        ) : (
        <Button
          className="w-full text-base"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const etat = await onJoin(inv);
              if (etat === "en_attente") {
                setAttente(true);
                setBusy(false);
              }
            } catch (e) {
              setError("Impossible de rejoindre : " + (e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Un instant…" : inv.cle ? "Rejoindre le groupe" : "Demander à rejoindre le groupe"}
        </Button>
        )}
      </div>
    </Page>
  );
}
