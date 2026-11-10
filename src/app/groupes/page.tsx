"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Header, Loading, Page, Progress, inputClass, useRequireUser } from "@/components/ui";
import { ActionRapide } from "@/components/ActionRapide";
import { dateCourte, fcfa, prenom } from "@/lib/format";
import { TYPE_LABEL, amountDue, beneficiary, impayes, memberStatus, dueDate, isLate, roundStats } from "@/lib/logic";
import { useStore } from "@/lib/store";
import { BottomNav } from "@/components/BottomNav";
import { Annonces } from "@/components/Annonces";
import { Bienvenue } from "@/components/Bienvenue";
import { AlertCircle, ChevronRight, ClipboardPaste, HandCoins, Headset, Link2, Plus, Repeat, Users, Wallet } from "lucide-react";
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
  const retards = groups
    .map((g) => ({ g, membres: g.members.filter((m) => memberStatus(g, m.id) === "retard") }))
    .filter((x) => x.membres.length > 0);

  // Bouton de la carte verte : descend jusqu'à la bonne liste et la fait clignoter
  const allerA = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("eclair");
    void el.offsetWidth;
    el.classList.add("eclair");
  };
  const totalCaisse = groups.reduce((n, g) => n + g.payments.reduce((s, p) => s + p.amount + p.penalty, 0), 0);

  return (
    <Page large>
      <Header
        right={
          <Link href="/aide" aria-label="Service client" className="rounded-full p-2 text-emerald-700 hover:bg-emerald-50">
            <Headset size={22} strokeWidth={1.9} />
          </Link>
        }
      />
      <div className="space-y-5 p-4 pb-28">
        <div className="degrade-vert relative overflow-hidden rounded-[22px] text-white">
          <div className="motif absolute inset-0 opacity-40" />
          <div className="relative px-5 pb-5 pt-5">
            <p className="text-sm text-emerald-50/80">Bonjour {prenom(user!.name)}</p>
            <p className="mt-4 text-[0.8rem] text-emerald-50/75">Total des cotisations enregistrées</p>
            <p className="mt-0.5 text-[2rem] font-extrabold leading-none tracking-tight">{fcfa(totalCaisse)}</p>
          </div>
          <div className="relative grid grid-cols-3 divide-x divide-white/15 border-t border-white/15 bg-black/10 text-center">
            {([["Groupes", String(groups.length), false, "mes-groupes"], ["À payer", String(aPayer.length), aPayer.length > 0, "a-payer"], ["En retard", String(enRetard), enRetard > 0, "en-retard"]] as const).map(([l, v, alerte, cible]) => (
              <button key={l} type="button" onClick={() => allerA(cible)} className="group px-2 py-3 transition hover:bg-white/10 active:bg-white/15">
                <p className={`text-lg font-extrabold leading-tight ${alerte ? "text-orange-200" : ""}`}>{v}</p>
                <p className="inline-flex items-center gap-0.5 text-[0.75rem] text-emerald-50/75">
                  {l} <ChevronRight size={12} strokeWidth={2.4} className="opacity-60 transition group-hover:translate-x-0.5" />
                </p>
              </button>
            ))}
          </div>
          <div className="bande-kente relative" />
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
            <h3 className="text-[0.95rem] font-bold text-stone-900">À payer</h3>
            {aPayer.length > 0 && <span className="text-sm text-stone-500">{aPayer.length} échéance{aPayer.length > 1 ? "s" : ""}</span>}
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
                  <Link href={`/groupes/${g.id}/payer?membre=${me.id}`} className="shrink-0 rounded-[12px] bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800">
                    Payer
                  </Link>
                </div>
              ))}
            </Card>
          )}
        </section>

        {/* En retard */}
        <section id="en-retard" className="scroll-mt-20 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.95rem] font-bold text-stone-900">En retard</h3>
            {enRetard > 0 && <span className="text-sm font-semibold text-red-600">{enRetard} membre{enRetard > 1 ? "s" : ""}</span>}
          </div>
          {retards.length === 0 ? (
            <Card className="!p-3.5 text-sm text-stone-500">Personne n’est en retard dans tes groupes.</Card>
          ) : (
            <Card className="divide-y divide-stone-100 !p-0">
              {retards.map(({ g, membres }) => (
                <Link key={g.id} href={`/groupes/${g.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertCircle size={18} strokeWidth={2} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{g.name}</p>
                    <p className="truncate text-[0.8125rem] text-red-600">{membres.map((m) => prenom(m.name)).join(", ")}</p>
                  </div>
                  <span className="shrink-0 rounded-[12px] bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700">Relancer</span>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section id="mes-groupes" className="scroll-mt-20 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[0.95rem] font-bold text-stone-900">Mes groupes</h3>
          <Link href="/groupes/nouveau" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><Plus size={16} strokeWidth={2.2} /> Nouveau</Link>
        </div>

        {groups.length === 0 && (
          <Card className="text-center text-sm text-stone-500">
            Aucun groupe pour l’instant. Crée ta première tontine, ou ouvre le lien d’invitation que ton trésorier t’a envoyé sur WhatsApp.
          </Card>
        )}

        {groups.length > 0 && (
          <Card className="divide-y divide-stone-100 overflow-hidden !p-0">
            {groups.map((g) => {
              const st = roundStats(g);
              const ben = beneficiary(g);
              const late = isLate(g, g.currentRound);
              const infos =
                g.type === "collecte"
                  ? `${st.counts.paye} participant${st.counts.paye > 1 ? "s" : ""} · jusqu’au ${dateCourte(g.startDate)}`
                  : `Tour ${g.currentRound}${g.type === "tontine" ? `/${g.order.length}` : ""}${ben ? ` · ${prenom(ben.name)} reçoit` : ""}`;
              return (
                <Link key={g.id} href={`/groupes/${g.id}`} className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-stone-50 active:bg-stone-100">
                  <IconBadge icon={TYPE_ICON[g.type]} ton={TYPE_TON[g.type]} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-stone-900">{g.name}</p>
                    <p className="truncate text-[0.8125rem] text-stone-500">{TYPE_LABEL[g.type]} · {infos}</p>
                    <Progress value={st.progress} className="mt-2.5 !h-1.5" />
                    <div className="mt-1.5 flex items-baseline justify-between gap-3 text-[0.8125rem]">
                      <p className="font-bold text-stone-900">{fcfa(st.collected)}</p>
                      <p className="text-stone-500">sur {fcfa(st.expected)}</p>
                    </div>
                    {g.type !== "collecte" && (late || st.counts.retard > 0) && (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                        <AlertCircle size={13} strokeWidth={2} />
                        {late ? "Échéance passée" : `Échéance le ${dateCourte(dueDate(g, g.currentRound).toISOString())}`}
                        {st.counts.retard > 0 && ` · ${st.counts.retard} en retard`}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} strokeWidth={1.8} className="shrink-0 text-stone-300" />
                </Link>
              );
            })}
          </Card>
        )}
        </section>
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
