"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Header, Loading, Page, Progress, inputClass, useRequireUser } from "@/components/ui";
import { ActionRapide } from "@/components/ActionRapide";
import { dateCourte, fcfa, prenom } from "@/lib/format";
import { TYPE_LABEL, amountDue, beneficiary, impayes, memberStatus, parFrequence, dueDate, isLate, roundStats } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { Annonces } from "@/components/Annonces";
import { Bienvenue } from "@/components/Bienvenue";
import { AlertCircle, CalendarDays, ClipboardPaste, Gift, HandCoins, Headset, Link2, Plus, Repeat, Users, Wallet } from "lucide-react";
import { IconBadge } from "@/components/icons";

const TYPE_ICON = { tontine: Repeat, association: Users, collecte: HandCoins };
const TYPE_TON = { tontine: "vert", association: "vert", collecte: "vert" } as const;

export default function Groupes() {
  const ok = useRequireUser();
  const { user, userId, groups, loaded } = useStore();
  const router = useRouter();
  const [rejoindre, setRejoindre] = useState(false);
  const [lien, setLien] = useState("");
  const [erreurLien, setErreurLien] = useState("");
  if (!ok || !loaded) return <Loading />;

  // Mes cotisations dues dans tous mes groupes (tour en cours et arriérés)
  const aPayer = groups.flatMap((g) => {
    if (g.type === "collecte") return [];
    const me = g.members.find((m) => !!userId && m.profileId === userId);
    if (!me) return [];
    const enAttente = g.pending.some((p) => p.memberId === me.id);
    const statut = memberStatus(g, me.id);
    const arr = impayes(g, me.id).filter((r) => r < g.currentRound).length;
    if (enAttente || (statut === "paye" && arr === 0)) return [];
    return [{ g, me, montant: amountDue(g).total, retard: statut === "retard" || arr > 0, echeance: dueDate(g, g.currentRound).toISOString() }];
  });

  const idDuLien = (t: string) => (t.match(/groupes\/([0-9a-f-]{36})/i) ?? t.trim().match(/^([0-9a-f-]{36})$/i))?.[1];

  const ouvrirLien = (texte = lien) => {
    const id = idDuLien(texte);
    if (!id) return setErreurLien("Colle le lien reçu sur WhatsApp (il contient « /groupes/ »).");
    setRejoindre(false);
    router.push(`/groupes/${id}`);
  };

  // Collage automatique : si un lien de groupe a été copié (WhatsApp « Copier »), on le reprend
  const collerDepuisPressePapiers = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (idDuLien(t)) {
        setLien(t.trim());
        setErreurLien("");
        return true;
      }
    } catch {}
    return false;
  };

  const ouvrirRejoindre = () => {
    setLien("");
    setErreurLien("");
    setRejoindre(true);
    collerDepuisPressePapiers();
  };

  const enRetard = groups.reduce((n, g) => n + roundStats(g).counts.retard, 0);
  const totalCaisse = groups.reduce((n, g) => n + g.payments.reduce((s, p) => s + p.amount + p.penalty, 0), 0);

  return (
    <Page>
      <Header
        right={
          <Link href="/aide" aria-label="Service client" className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50">
            <Headset size={22} strokeWidth={1.9} />
          </Link>
        }
      />
      <div className="space-y-5 p-4 pb-28">
        <div className="degrade-vert relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-emerald-900/15">
          <div className="motif absolute inset-0 opacity-60" />
          <p className="relative text-sm text-emerald-50/90">Bonjour,</p>
          <h2 className="relative text-2xl font-extrabold tracking-tight">{prenom(user!.name)}</h2>
          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-white/[0.12] p-3 ring-1 ring-white/15">
              <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-emerald-50/80">Total collecté</p>
              <p className="mt-0.5 text-lg font-extrabold">{fcfa(totalCaisse)}</p>
            </div>
            <div className="rounded-2xl bg-white/[0.12] p-3 ring-1 ring-white/15">
              <p className="text-[0.8125rem] font-semibold uppercase tracking-wide text-emerald-50/80">À relancer</p>
              <p className={`mt-0.5 text-lg font-extrabold ${enRetard ? "text-orange-200" : ""}`}>{enRetard} retard{enRetard > 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="grid grid-cols-4 gap-1">
          <ActionRapide label="Créer" href="/groupes/nouveau" interne>
            <Plus size={22} strokeWidth={1.9} />
          </ActionRapide>
          <ActionRapide label="Rejoindre" onClick={ouvrirRejoindre}>
            <Link2 size={20} strokeWidth={1.9} />
          </ActionRapide>
          <ActionRapide label="À payer" badge={aPayer.length || undefined} onClick={() => document.getElementById("a-payer")?.scrollIntoView({ behavior: "smooth" })}>
            <Wallet size={20} strokeWidth={1.9} />
          </ActionRapide>
          <ActionRapide label="Contact" href="/aide" interne>
            <Headset size={20} strokeWidth={1.9} />
          </ActionRapide>
        </div>

        <Annonces />

        {/* À payer */}
        <section id="a-payer" className="scroll-mt-20 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-stone-800">À payer</h3>
            <span className="text-sm text-stone-500">{aPayer.length}</span>
          </div>
          {aPayer.length === 0 ? (
            <Card className="!p-3.5 text-sm text-stone-500">Tu es à jour dans tous tes groupes.</Card>
          ) : (
            <Card className="divide-y divide-stone-100 !p-0">
              {aPayer.map(({ g, me, montant, retard, echeance }) => (
                <div key={g.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    <p className={`text-[0.8125rem] ${retard ? "font-semibold text-red-600" : "text-stone-500"}`}>
                      {retard ? "En retard" : `Avant le ${dateCourte(echeance)}`} · {fcfa(montant)}
                    </p>
                  </div>
                  <Link href={`/groupes/${g.id}/payer?membre=${me.id}`} className="shrink-0 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white">
                    Payer
                  </Link>
                </div>
              ))}
            </Card>
          )}
        </section>

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
                        {g.type !== "collecte" && ` · ${fcfa(g.amount)}/${parFrequence(g.frequency)}`}
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

      {rejoindre && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setRejoindre(false)}>
          <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-5 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold">Rejoindre un groupe</h3>
            {idDuLien(lien) ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200">Lien de groupe détecté ✓</p>
            ) : (
              <p className="text-sm text-stone-600">
                Le plus simple : touche directement le lien reçu sur WhatsApp. Sinon, copie-le puis touche « Coller ».
              </p>
            )}
            <div className="flex gap-2">
              <input className={inputClass} value={lien} onChange={(e) => { setLien(e.target.value); setErreurLien(""); }} placeholder="https://tontine-et-cotise.vercel.app/groupes/…" inputMode="url" />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0 !px-3"
                onClick={async () => {
                  if (!(await collerDepuisPressePapiers())) setErreurLien("Aucun lien de groupe copié. Copie d’abord le lien dans WhatsApp (appui long → Copier).");
                }}
              >
                <ClipboardPaste size={17} strokeWidth={1.9} /> Coller
              </Button>
            </div>
            {erreurLien && <p className="text-sm text-red-600">{erreurLien}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setRejoindre(false)}>Annuler</Button>
              <Button onClick={() => ouvrirLien()} disabled={!lien.trim()}>{idDuLien(lien) ? "Rejoindre ce groupe" : "Ouvrir"}</Button>
            </div>
          </div>
        </div>
      )}
      <Bienvenue nom={user!.name} />
      <BottomNav />
    </Page>
  );
}
