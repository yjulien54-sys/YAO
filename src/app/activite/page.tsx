"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { IconBadge } from "@/components/icons";
import { Card, Header, Loading, Page, useRequireUser } from "@/components/ui";
import { fcfa } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments";
import { useStore } from "@/lib/store";
import { nomMembre } from "@/lib/logic";

type Evt = { id: string; date: string; type: "paiement" | "attente" | "versement"; titre: string; detail: string; montant: number; href: string };

const jour = (iso: string) => {
  const d = new Date(iso);
  const auj = new Date();
  const hier = new Date();
  hier.setDate(auj.getDate() - 1);
  if (d.toDateString() === auj.toDateString()) return "Aujourd’hui";
  if (d.toDateString() === hier.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

export default function ActivitePage() {
  const ok = useRequireUser();
  const { groups, loaded } = useStore();
  if (!ok || !loaded) return <Loading />;

  const evts: Evt[] = [];
  for (const g of groups) {
    const nom = (id?: string | null) => nomMembre(g, id);
    for (const p of g.payments)
      evts.push({ id: p.id, date: p.date, type: "paiement", titre: `${nom(p.memberId)} a payé`, detail: `${g.name} · ${METHOD_LABEL[p.method]}${g.type !== "collecte" ? ` · Tour ${p.round}` : ""}`, montant: p.amount + p.penalty, href: `/groupes/${g.id}/recu/${p.id}` });
    for (const p of g.pending)
      evts.push({ id: p.id, date: p.date, type: "attente", titre: `${nom(p.memberId)} a déclaré un paiement`, detail: `${g.name} · à confirmer par le trésorier`, montant: p.amount + p.penalty, href: `/groupes/${g.id}` });
    for (const v of g.payouts)
      evts.push({ id: v.id, date: v.date, type: "versement", titre: `Versé à ${v.beneficiaryName}`, detail: `${g.name} · ${METHOD_LABEL[v.method]}`, montant: v.amount, href: `/groupes/${g.id}` });
  }
  evts.sort((a, b) => b.date.localeCompare(a.date));
  const liste = evts.slice(0, 80);
  const parJour: [string, Evt[]][] = [];
  for (const e of liste) {
    const j = jour(e.date);
    const last = parJour[parJour.length - 1];
    if (last && last[0] === j) last[1].push(e);
    else parJour.push([j, [e]]);
  }

  return (
    <Page>
      <Header title="Activité" />
      <div className="space-y-5 p-4 pb-28">
        {liste.length === 0 && (
          <Card className="text-center text-sm text-stone-500">Aucune activité pour l’instant. Les paiements et versements de tes groupes apparaîtront ici.</Card>
        )}
        {parJour.map(([j, es]) => (
          <section key={j}>
            <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">{j}</h2>
            <Card className="divide-y divide-stone-100 !p-0">
              {es.map((e) => (
                <Link key={e.id} href={e.href} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <IconBadge
                    icon={e.type === "paiement" ? CheckCircle2 : e.type === "attente" ? Clock : ArrowUpRight}
                    ton={e.type === "paiement" ? "vert" : e.type === "attente" ? "ambre" : "orange"}
                    taille="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{e.titre}</p>
                    <p className="truncate text-xs text-stone-500">{e.detail} · {new Date(e.date).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-bold ${e.type === "versement" ? "text-orange-600" : e.type === "attente" ? "text-amber-600" : "text-emerald-700"}`}>
                    {e.type === "versement" ? "−" : "+"}{fcfa(e.montant)}
                  </p>
                </Link>
              ))}
            </Card>
          </section>
        ))}
      </div>
      <BottomNav />
    </Page>
  );
}
