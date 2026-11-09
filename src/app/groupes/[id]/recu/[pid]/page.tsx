"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Header, Loading, Logo, Page, WhatsAppIcon, btnClass, useRequireUser } from "@/components/ui";
import { dateLongue, fcfa } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments";
import { useStore } from "@/lib/store";
import { partageRecu } from "@/lib/whatsapp";
import { BadgeCheck } from "lucide-react";
import { IconBadge } from "@/components/icons";

export default function RecuPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Recu />
    </Suspense>
  );
}

function Recu() {
  const ok = useRequireUser();
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const sp = useSearchParams();
  const nouveau = sp.get("nouveau") === "1";
  const nbTours = Number(sp.get("n") ?? "1");
  const { getGroup, loaded } = useStore();
  const g = getGroup(id);
  const p = g?.payments.find((x) => x.id === pid);
  const m = g ? [...g.members, ...g.anciens].find((x) => x.id === p?.memberId) : undefined;

  if (!ok || !loaded) return <Loading />;
  if (!g || !p)
    return (
      <Page>
        <Header back="/groupes" title="Reçu" />
        <p className="p-6 text-center text-stone-500">Reçu introuvable.</p>
      </Page>
    );

  const rows: [string, string][] = [
    ["Groupe", g.name],
    ["Membre", m?.name ?? "Ancien membre"],
    ...(g.type !== "collecte" ? ([["Tour", String(p.round)]] as [string, string][]) : []),
    ["Cotisation", fcfa(p.amount)],
    ...(p.penalty ? ([["Pénalité", fcfa(p.penalty)]] as [string, string][]) : []),
    ["Moyen", METHOD_LABEL[p.method]],
    ["Date", dateLongue(p.date)],
    ["Référence", p.reference],
  ];

  return (
    <Page>
      <Header back={`/groupes/${g.id}`} title="Reçu de paiement" />
      <div className="space-y-4 p-4">
        {nouveau && (
          <div className="text-center">
            <IconBadge icon={BadgeCheck} taille="xl" className="mx-auto" />
            <h2 className="mt-3 text-xl font-extrabold">Paiement réussi !</h2>
            <p className="text-sm text-stone-600">Le groupe a été mis à jour pour tout le monde.</p>
            {nbTours > 1 && <p className="mt-2 text-sm font-semibold text-emerald-700">{nbTours} tours payés d’un coup (un reçu par tour, visibles dans l’historique)</p>}
          </div>
        )}
        <div className="relative rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <Logo className="text-base" />
            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">PAYÉ</span>
          </div>
          <p className="mt-5 text-center text-sm text-stone-500">Montant</p>
          <p className="text-center text-4xl font-extrabold">{fcfa(p.amount + p.penalty)}</p>
          <div className="my-5 border-t-2 border-dashed border-stone-200" />
          <dl className="space-y-2.5 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-stone-500">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        {m && (
          <a href={partageRecu(g, m, p)} target="_blank" rel="noreferrer" className={btnClass("whatsapp", "w-full")}>
            <WhatsAppIcon /> Partager le reçu sur WhatsApp
          </a>
        )}
        <Link href={`/groupes/${g.id}`} className={btnClass("secondary", "w-full")}>Retour au groupe</Link>
      </div>
    </Page>
  );
}
