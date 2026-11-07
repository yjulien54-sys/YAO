"use client";

import Link from "next/link";
import { Card, Header, Loading, Page, Progress, btnClass, useRequireUser } from "@/components/ui";
import { dateCourte, fcfa, prenom } from "@/lib/format";
import { TYPE_LABEL, beneficiary, dueDate, isLate, roundStats } from "@/lib/logic";
import { useStore } from "@/lib/store";

const TYPE_ICON = { tontine: "🔄", association: "🤝", collecte: "🕊️" };

export default function Groupes() {
  const ok = useRequireUser();
  const { user, groups, logout, loaded } = useStore();
  if (!ok || !loaded) return <Loading />;

  const enRetard = groups.reduce((n, g) => n + roundStats(g).counts.retard, 0);
  const totalCaisse = groups.reduce((n, g) => n + g.payments.reduce((s, p) => s + p.amount + p.penalty, 0), 0);

  return (
    <Page>
      <Header
        right={
          <button onClick={() => confirm("Te déconnecter ? En phase de test, tu devras rejoindre à nouveau tes groupes avec leur lien d’invitation.") && logout()} className="rounded-lg px-2 py-1 text-sm font-medium text-stone-500 hover:bg-stone-100">
            Déconnexion
          </button>
        }
      />
      <div className="space-y-5 p-4">
        <div>
          <p className="text-sm text-stone-500">Bonjour 👋</p>
          <h2 className="text-2xl font-extrabold">{prenom(user!.name)}</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-3.5">
            <p className="text-xs font-medium text-stone-500">Total collecté</p>
            <p className="mt-1 text-lg font-extrabold text-emerald-700">{fcfa(totalCaisse)}</p>
          </Card>
          <Card className="!p-3.5">
            <p className="text-xs font-medium text-stone-500">Retards à relancer</p>
            <p className={`mt-1 text-lg font-extrabold ${enRetard ? "text-red-600" : "text-stone-800"}`}>{enRetard}</p>
          </Card>
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
                <Card className="transition hover:border-emerald-300 hover:shadow-md">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 text-xl">{TYPE_ICON[g.type]}</span>
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
                        {ben && <span>🎁 {prenom(ben.name)}</span>}
                        <span className={late ? "font-semibold text-red-600" : ""}>
                          {late ? "⏰ Échéance passée" : `📅 ${dateCourte(dueDate(g, g.currentRound).toISOString())}`}
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

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-md bg-gradient-to-t from-stone-50 via-stone-50 to-transparent p-4 pt-8">
        <Link href="/groupes/nouveau" className={btnClass("primary", "w-full shadow-lg shadow-emerald-900/20")}>
          + Créer un groupe
        </Link>
      </div>
    </Page>
  );
}
