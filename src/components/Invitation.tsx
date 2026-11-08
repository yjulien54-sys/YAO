"use client";

import { useEffect, useState } from "react";
import { HeartHandshake } from "lucide-react";
import { IconBadge } from "./icons";
import { Button, Header, Loading, Page } from "./ui";
import { supabase } from "@/lib/supabase";

/** Page d'invitation : affichée quand on ouvre le lien d'un groupe dont on n'est pas encore membre */
const TYPE_NOM: Record<string, string> = { tontine: "la tontine", association: "l’association", collecte: "la collecte" };

export function Invitation({ id, onJoin }: { id: string; onJoin: () => Promise<void> }) {
  const [info, setInfo] = useState<{ name: string; type: string; members_count: number } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.rpc("group_preview", { g: id }).then(({ data }) => setInfo(data?.[0] ?? null));
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
        <Button
          className="w-full text-base"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onJoin();
            } catch (e) {
              setError("Impossible de rejoindre : " + (e as Error).message);
              setBusy(false);
            }
          }}
        >
          {busy ? "Un instant…" : "Rejoindre le groupe"}
        </Button>
      </div>
    </Page>
  );
}
