"use client";

import Link from "next/link";
import { Bell, CheckCircle2, Clock, ShieldCheck, UserPlus, XCircle } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { IconBadge } from "@/components/icons";
import { Card, Header, Loading, Page, useRequireUser } from "@/components/ui";
import { useNotifications } from "@/lib/notifications";

const ICONE: Record<string, [typeof Bell, "vert" | "ambre" | "rouge" | "bleu" | "violet"]> = {
  paiement_declare: [Clock, "ambre"],
  paiement_confirme: [CheckCircle2, "vert"],
  paiement_refuse: [XCircle, "rouge"],
  demande_adhesion: [UserPlus, "bleu"],
  adhesion_acceptee: [UserPlus, "vert"],
  versement_a_valider: [ShieldCheck, "violet"],
  versement_valide: [CheckCircle2, "vert"],
  versement_refuse: [XCircle, "rouge"],
};

function ilYa(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "à l’instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  const j = Math.floor(s / 86400);
  return j === 1 ? "hier" : `il y a ${j} jours`;
}

export default function Notifications() {
  const ok = useRequireUser();
  const { liste, nonLues, dispo, marquerLue, marquerToutLu } = useNotifications();
  if (!ok) return <Loading />;

  return (
    <Page>
      <Header
        back="/groupes"
        title="Notifications"
        right={nonLues > 0 ? <button onClick={marquerToutLu} className="text-sm font-semibold text-emerald-700">Tout marquer lu</button> : undefined}
      />
      <div className="space-y-3 p-4 pb-28">
        {!dispo && <Card className="text-sm text-stone-500">Les notifications seront bientôt disponibles.</Card>}
        {dispo && liste.length === 0 && (
          <Card className="space-y-2 py-8 text-center">
            <Bell className="mx-auto text-stone-300" size={36} />
            <p className="text-sm text-stone-500">Aucune notification pour l’instant. Tu seras prévenu ici quand un paiement est confirmé, quand quelqu’un veut rejoindre ton groupe ou quand un versement est à valider.</p>
          </Card>
        )}
        {liste.length > 0 && (
          <Card className="divide-y divide-stone-100 overflow-hidden !p-0">
            {liste.map((n) => {
              const [I, ton] = ICONE[n.type] ?? [Bell, "vert"];
              const contenu = (
                <>
                  <IconBadge icon={I} ton={ton} taille="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${n.lue ? "font-semibold text-stone-700" : "font-bold text-stone-900"}`}>{n.titre}</p>
                    {n.texte && <p className="text-[0.8125rem] leading-snug text-stone-600">{n.texte}</p>}
                    <p className="mt-0.5 text-xs text-stone-400">{ilYa(n.le)}</p>
                  </div>
                  {!n.lue && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" aria-label="Non lue" />}
                </>
              );
              const cls = `flex items-start gap-3 px-4 py-3 transition hover:bg-stone-50 ${n.lue ? "" : "bg-emerald-50/40"}`;
              return n.lien ? (
                <Link key={n.id} href={n.lien} onClick={() => marquerLue(n.id)} className={cls}>{contenu}</Link>
              ) : (
                <button key={n.id} type="button" onClick={() => marquerLue(n.id)} className={`${cls} w-full text-left`}>{contenu}</button>
              );
            })}
          </Card>
        )}
      </div>
      <BottomNav />
    </Page>
  );
}
