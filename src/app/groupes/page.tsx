"use client";

import Link from "next/link";
import { Card, Header, Loading, Page, Progress, btnClass, useRequireUser } from "@/components/ui";
import { dateCourte, fcfa, prenom } from "@/lib/format";
import { TYPE_LABEL, beneficiary, dueDate, isLate, roundStats } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { AlertCircle, CalendarDays, Gift, HandCoins, Plus, Repeat, Users } from "lucide-react";
import { IconBadge } from "@/components/icons";

const TYPE_ICON = { tontine: Repeat, association: Users, collecte: HandCoins };
const TYPE_TON = { tontine: "orange", association: "bleu", collecte: "violet" } as const;

export default function Groupes() {
  const ok = useRequireUser();
  const { user, groups, loaded } = useStore();
  if (!ok || !loaded) return <Loading />;

  const enRetard = groups.reduce((n, g) => n + roundStats(g).counts.retard, 0);
  const totalCaisse = groups.reduce((n, g) => n + g.payments.reduce((s, p) => s + p.amount + p.penalty, 0), 0);

  return (
    <Page>
      <Header />
      <div className="space-y-5 p-4 pb-40">
        <div className="degrade-vert relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-emerald-900/15">
          <div className="motif absolute inset-0 opacity-60" />
          <p className="relative text-sm text-emerald-50/90">Bonjour,</p>
          <h2 className="relative text-2xl font-extrabold tracking-tight">{prenom(user!.name)}</h2>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.12] p-3 ring-1 ring-white/15">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-50/80">Total collecté</p>
              <p className="mt-0.5 text-lg font-extrabold">{fcfa(totalCaisse)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.12] p-3 ring-1 ring-white/15">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-50/80">À relancer</p>
              <p className={`mt-0.5 text-lg font-extrabold ${enRetard ? "text-orange-200" : ""}`}>{enRetard} retard{enRetard > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="font-bold text-stone-800">Mes groupes</h3>
          <span className="text-sm text-stone-500">{groups.length}</span>
        </div>

        {groups.length === 0 && (
          <Card className="text-center text-sm text-stone-500">
            Aucun groupe pour l’instant. Crée ta première tontine, ou ouvre le lien d’invitation que ton trésorier t’a envoyé sur WhatsApp.
          </Card>
        )}

        <div className="space-y-3">
          {groups.map((g) => {
            const st = roundStats(g);
            const ben = beneficiary(g);
            const late = isLate(g, g.currentRound);
            return (
              <Link key={g.id} href={`/groupes/${g.id}`} className="block">
                <Card className="transition active:scale-[0.99] hover:border-emerald-300">
                  <div className="flex items-start gap-3">
                    <IconBadge icon={TYPE_ICON[g.type]} ton={TYPE_TON[g.type]} taille="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-stone-900">{g.name}</p>
                      <p className="text-xs text-stone-500">
                        {TYPE_LABEL[g.type]} · {g.members.length} membres
                        {g.type !== "collecte" && ` · ${fcfa(g.amount)}/${g.frequency === "mensuelle" ? "mois" : "sem."}`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="font-bold text-stone-900">{fcfa(st.collected)}</span>
                    <span className="text-stone-500">sur {fcfa(st.expected)}</span>
                  </div>
                  <Progress value={st.progress} className="mt-1.5" />
                  <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-600">
                    {g.type === "collecte" ? (
                      <span>{st.counts.paye} participant(s) · jusqu’au {dateCourte(g.startDate)}</span>
                    ) : (
                      <>
                        <span>Tour {g.currentRound}{g.type === "tontine" && `/${g.order.length}`}</span>
                        {ben && <span className="inline-flex items-center gap-1"><Gift size={13} strokeWidth={1.75} />{prenom(ben.name)}</span>}
                        <span className={`inline-flex items-center gap-1 ${late ? "font-semibold text-red-600" : ""}`}>
                          {late ? <AlertCircle size={13} strokeWidth={1.75} /> : <CalendarDays size={13} strokeWidth={1.75} />}
                          {late ? "Échéance passée" : dateCourte(dueDate(g, g.currentRound).toISOString())}
                        </span>
                        {st.counts.retard > 0 && <span className="font-semibold text-red-600">{st.counts.retard} en retard</span>}
                      </>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>

      </div>

      <div className="fixed inset-x-0 bottom-[60px] z-10 mx-auto max-w-md bg-gradient-to-t from-[#f7f5f0] via-[#f7f5f0] to-transparent p-4 pt-8">
        <Link href="/groupes/nouveau" className={btnClass("primary", "w-full shadow-lg shadow-emerald-900/20")}>
          <Plus size={18} strokeWidth={2} /> Créer un groupe
        </Link>
      </div>
      <BottomNav />
    </Page>
  );
}
