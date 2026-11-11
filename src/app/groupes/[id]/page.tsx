"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar, Button, Card, Header, Loading, Page, Progress, StatusBadge, WhatsAppIcon, btnClass, inputClass, useRequireUser } from "@/components/ui";
import { dateCourte, dateLongue, fcfa, prenom, telAffiche } from "@/lib/format";
import { NATURE_LABEL, ROLE_LABEL, TYPE_LABEL, amountDue, droits, impayes, arrears, beneficiary, caisse, dueDate, isLate, memberStatus, netDuTour, paidUntil, payoutFor, paymentsOf, roundStats, roundsToPay, sum, unpaidMembers } from "@/lib/logic";
import { PayoutModal } from "@/components/PayoutModal";
import { METHOD_LABEL, MODE_PAIEMENT } from "@/lib/payments";
import { useMe, useStore } from "@/lib/store";
import { invitation, waLink } from "@/lib/whatsapp";
import { supabase } from "@/lib/supabase";
import { MessageModal } from "@/components/MessageModal";
import { Invitation } from "@/components/Invitation";
import { Tirage } from "@/components/Tirage";
import { ActionRapide } from "@/components/ActionRapide";
import { Reglement } from "@/components/Reglement";
import { CaissePenalites } from "@/components/CaissePenalites";
import { CaisseGroupe } from "@/components/CaisseGroupe";
import { AlertTriangle, ArrowUpRight, CalendarDays, ChevronsRight, FileText, Flag, History, Users, MessageCircle, Phone, Settings, Check, CheckCircle2, Clock, Gift, PartyPopper, Smartphone, ShieldCheck, Trash2, LogOut, UserPlus, X } from "lucide-react";
import { IconBadge } from "@/components/icons";
import type { Member } from "@/lib/types";

type Tab = "membres" | "historique" | "tours";

export default function GroupeDetail() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const { getGroup, recordPayment, recordPayout, confirmPayments, setPaymentPhone, addMember, nextRound, joinGroup, repondreDemande, annulerDeclaration, quitterGroupe, validerVersement, annulerVersement, loaded, userId } = useStore();
  const router = useRouter();
  const g = getGroup(id);
  const me = useMe(g);
  const [tab, setTab] = useState<Tab>("membres");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newParts, setNewParts] = useState(1);
  const [toast, setToast] = useState("");
  const [msg, setMsg] = useState<{ type: "relance" | "groupe"; member?: Member } | null>(null);
  const [versement, setVersement] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);
  const pret = ok && loaded && !!g;

  // Créateur ou trésorier : son lien d'invitation porte une clé qui fait entrer directement (SQL n°15)
  const [cleInvit, setCleInvit] = useState<string | null>(null);
  useEffect(() => {
    if (!pret) return;
    supabase.rpc("cle_invitation", { g: id }).then(({ data, error }) => !error && setCleInvit((data as string | null) ?? null));
  }, [pret, id]);

  // Arrivée depuis l'alerte « à confirmer » de l'accueil : on descend jusqu'au bouton « Reçu »
  useEffect(() => {
    const cible = window.location.hash.slice(1);
    if (!pret || !["a-confirmer", "a-valider"].includes(cible)) return;
    const t = setTimeout(() => {
      const el = document.getElementById(cible);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("eclair");
    }, 350);
    return () => clearTimeout(t);
  }, [pret]);

  if (!ok || !loaded) return <Loading />;
  if (!g) return <Invitation id={id} onJoin={(inv) => joinGroup(id, inv)} />;

  const st = roundStats(g);
  const ben = beneficiary(g);
  const late = isLate(g, g.currentRound);
  const due = amountDue(g);
  const dr = droits(g, me, userId);
  const isTreasurer = dr.tresorier;
  const myStatus = me ? memberStatus(g, me.id) : undefined;
  const unpaid = unpaidMembers(g);
  const finished = g.type === "tontine" && g.currentRound >= g.order.length;
  const cs = caisse(g);
  const netTour = netDuTour(g);
  const versementTour = g.type === "tontine" ? payoutFor(g) : undefined;
  const mesArrieres = me ? arrears(g, me.id) : [];
  const peutAvancer = me && g.type !== "collecte" && roundsToPay(g, me.id).length > 0;
  const fraisTour = st.collected - netTour;
  // Paiements déclarés, regroupés par déclaration (même membre + même référence)
  const declarations = Object.values(
    g.pending.reduce<Record<string, typeof g.pending>>((acc, p) => {
      const k = `${p.memberId}|${p.transactionId ?? p.id}`;
      (acc[k] ??= []).push(p);
      return acc;
    }, {})
  );
  const mesDeclarations = me ? g.pending.filter((p) => p.memberId === me.id) : [];
  const enValidation = (g.demandesVersement ?? []).filter((d) => d.statut === "en_attente");
  const tourEnAttente = me ? mesDeclarations.some((p) => p.round === g.currentRound || g.type === "collecte") : false;
  const tresorier = g.members.find((m) => m.role === "tresorier");
  const termine =
    g.type === "collecte"
      ? Date.now() > new Date(g.startDate).getTime() + 24 * 3600 * 1000
      : g.type === "tontine" && g.order.length > 0 && g.currentRound >= g.order.length && !!payoutFor(g, g.order.length);

  // Badge « À confirmer » : le trésorier est emmené au bouton « Reçu »
  const voirConfirmation = () => {
    if (!isTreasurer) return flash("Paiement déclaré : le trésorier doit confirmer qu’il a reçu l’argent.");
    const el = document.getElementById("a-confirmer");
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.remove("eclair");
    void el.offsetWidth;
    el.classList.add("eclair");
  };

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  };

  const sortedMembers = [...g.members].sort((a, b) => {
    const rank = { retard: 0, attente: 1, a_confirmer: 2, paye: 3 };
    return rank[memberStatus(g, a.id)] - rank[memberStatus(g, b.id)];
  });

  return (
    <Page>
      <Header
        back="/groupes"
        title={g.name}
        right={
          dr.gestionnaire ? (
            <Link href={`/groupes/${g.id}/parametres`} aria-label="Paramètres du groupe" className="rounded-full p-2 text-stone-600 hover:bg-stone-100">
              <Settings size={20} strokeWidth={1.9} />
            </Link>
          ) : undefined
        }
      />

      <div className="space-y-4 p-4">
        {/* Résumé */}
        <Card className="overflow-hidden !p-0">
          <div className="degrade-vert relative overflow-hidden p-5 text-white">
            <div className="motif pointer-events-none absolute inset-0 opacity-40" />
            <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
            <div className="relative">
            <div className="flex items-center justify-between text-[0.8rem] font-medium text-emerald-50/80">
              <span>{TYPE_LABEL[g.type]}</span>
              {g.type !== "collecte" && <span>Tour {g.currentRound}{g.type === "tontine" && ` sur ${g.order.length}`}</span>}
            </div>
            <p className="mt-2 text-sm text-emerald-100">{g.type === "collecte" ? "Collecté" : "Dans la caisse du tour"}</p>
            <p className="mt-0.5 text-[2.1rem] font-extrabold leading-tight tracking-tight">{fcfa(st.collected)}</p>
            <p className="text-sm text-emerald-100">sur {fcfa(st.expected)} {g.type === "collecte" ? "d’objectif" : "attendus"}</p>
            <Progress value={st.progress} className="mt-3 bg-white/25" />
            {(g.type === "collecte" ? cs.frais : fraisTour) > 0 && (
              <p className="mt-2 text-xs text-emerald-100">
                Frais Mobile Money : −{fcfa(g.type === "collecte" ? cs.frais : fraisTour)} · Net : <b className="text-white">{fcfa(g.type === "collecte" ? cs.net : netTour)}</b>
              </p>
            )}
            {g.type !== "tontine" && cs.verse > 0 && (
              <p className="mt-1 text-xs text-emerald-100">Déjà versé : {fcfa(cs.verse)} · Solde de la caisse : <b className="text-white">{fcfa(cs.solde)}</b></p>
            )}
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-stone-200 text-center">
            <Stat n={st.counts.paye} label="Payé" cls="text-emerald-700" />
            <Stat n={st.counts.attente + st.counts.a_confirmer} label="En attente" cls="text-amber-600" />
            <Stat n={st.counts.retard} label="En retard" cls="text-red-600" />
          </div>
        </Card>

        <CaisseGroupe g={g} userId={userId} />

        {enValidation.length > 0 && (
          <div id="a-valider" className="scroll-mt-20 rounded-[18px]">
            <Card className="space-y-3 border-violet-200 bg-violet-50/60">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={ShieldCheck} ton="violet" taille="sm" />Versement en attente de validation</p>
                <p className="text-xs text-stone-600">Par sécurité, l’argent ne sort qu’après l’accord de plusieurs responsables du groupe.</p>
              </div>
              {enValidation.map((d) => {
                const oui = d.validations.filter((v) => v.accord);
                const jaiVote = !!userId && d.validations.some((v) => v.profileId === userId);
                const qui = (pid: string) => g.members.find((m) => m.profileId === pid)?.name ?? "Responsable";
                return (
                  <div key={d.id} className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-stone-200">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{fcfa(d.amount)} pour {d.beneficiaryName}</p>
                        <p className="text-xs text-stone-500">Demandé par {qui(d.demandePar)} · {dateLongue(d.date)}{d.note ? ` · ${d.note}` : ""}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-800">{oui.length}/{d.requis}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(oui.length / d.requis) * 100}%` }} /></div>
                    <p className="text-xs text-stone-600">Validé par : {oui.map((v) => prenom(qui(v.profileId))).join(", ")}</p>
                    {dr.gestionnaire && !jaiVote && (
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="!py-2" onClick={() => confirm(`Refuser ce versement de ${fcfa(d.amount)} ?`) && validerVersement(d.id, false).then(() => flash("Versement refusé")).catch((e) => flash("Erreur : " + e.message))}>
                          <X size={16} strokeWidth={2} /> Refuser
                        </Button>
                        <Button className="!py-2" onClick={() => validerVersement(d.id, true).then((st) => flash(st === "valide" ? "Versement validé et enregistré" : "Ta validation est enregistrée")).catch((e) => flash("Erreur : " + e.message))}>
                          <Check size={16} strokeWidth={2.25} /> Valider
                        </Button>
                      </div>
                    )}
                    {jaiVote && <p className="text-xs font-semibold text-violet-800">Tu as validé. En attente des autres responsables.</p>}
                    {!dr.gestionnaire && <p className="text-xs text-stone-500">Les responsables du groupe doivent valider ce versement.</p>}
                    {(userId === d.demandePar || isTreasurer) && (
                      <button type="button" onClick={() => confirm("Annuler cette demande de versement ?") && annulerVersement(d.id).then(() => flash("Demande annulée")).catch((e) => flash("Erreur : " + e.message))} className="text-xs font-semibold text-stone-500 underline">
                        Annuler la demande
                      </button>
                    )}
                  </div>
                );
              })}
            </Card>
          </div>
        )}

        {dr.gestionnaire && g.demandes.length > 0 && (
          <Card className="space-y-3 border-sky-200 bg-sky-50/60">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={UserPlus} ton="bleu" taille="sm" />Demandes pour rejoindre ({g.demandes.length})</p>
              <p className="text-xs text-stone-600">Ces personnes ont été invitées par un membre. C’est toi qui décides : accepte seulement celles que tu connais.</p>
            </div>
            {g.demandes.map((d) => (
              <div key={d.id} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-stone-200">
                <Avatar name={d.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{d.name}</p>
                  <p className="whitespace-nowrap text-xs text-stone-500">{telAffiche(d.phone)}</p>
                  {d.invitePar && <p className="truncate text-xs font-medium text-sky-800">Invité(e) par {d.invitePar}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => confirm(`Refuser la demande de ${d.name} ?`) && repondreDemande(d.id, false).then(() => flash("Demande refusée")).catch((e) => flash("Erreur : " + e.message))}
                  className="shrink-0 rounded-lg bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700"
                >
                  Refuser
                </button>
                <button
                  type="button"
                  onClick={() => repondreDemande(d.id, true).then(() => flash(`${prenom(d.name)} fait maintenant partie du groupe`)).catch((e) => flash("Erreur : " + e.message))}
                  className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white"
                >
                  Accepter
                </button>
              </div>
            ))}
          </Card>
        )}

        {isTreasurer && declarations.length > 0 && (
          <div id="a-confirmer" className="scroll-mt-20 rounded-[18px]">
          <Card className="space-y-3 border-amber-300 bg-amber-50/60">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={Clock} ton="ambre" taille="sm" />Paiements à confirmer ({declarations.length})</p>
              <p className="text-xs text-stone-600">Vérifie sur ton téléphone que tu as bien reçu l’argent avant de confirmer.</p>
            </div>
            {declarations.map((d) => {
              const m = g.members.find((x) => x.id === d[0].memberId);
              const refOperateur = d[0].transactionId && !d[0].transactionId.startsWith("DECL-") ? d[0].transactionId : null;
              return (
                <div key={d[0].id} className="rounded-xl bg-white p-3 ring-1 ring-stone-200">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{m?.name ?? "Membre"}</p>
                      <p className="text-xs text-stone-500">
                        {METHOD_LABEL[d[0].method]} · {dateLongue(d[0].date)}
                        {g.type !== "collecte" && ` · Tour${d.length > 1 ? "s" : ""} ${d.map((p) => p.round).join(", ")}`}
                      </p>
                      {refOperateur && <p className="text-xs font-semibold text-stone-700">Réf. : {refOperateur}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-extrabold">{fcfa(sum(d))}</p>
                      {d.some((p) => p.penalty > 0) && (
                        <p className="text-[0.8125rem] font-semibold text-red-600">dont {fcfa(d.reduce((s, p) => s + p.penalty, 0))} de pénalité</p>
                      )}
                    </div>
                  </div>
                  {g.type !== "collecte" && g.penalty > 0 && d.every((p) => p.penalty === 0) && (
                    <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[0.8125rem] font-semibold text-emerald-800">
                      <Check size={13} strokeWidth={2.4} /> Déclaré à temps : aucune pénalité, même si tu confirmes après l’échéance
                    </p>
                  )}
                  <p className="mt-1.5 text-[0.8125rem] text-stone-500">Confirme seulement si tu as reçu <b>{fcfa(sum(d))}</b> au total. S’il manque de l’argent, touche « Pas reçu » et préviens le membre.</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="!py-2"
                      onClick={() => {
                        if (confirm(`Refuser ce paiement de ${m?.name} ? (argent non reçu)`))
                          confirmPayments(d.map((p) => p.id), false).then(() => flash("Paiement refusé")).catch((e) => flash("Erreur : " + e.message));
                      }}
                    >
                      <X size={16} strokeWidth={2} /> Pas reçu
                    </Button>
                    <Button
                      className="!py-2"
                      onClick={() =>
                        confirmPayments(d.map((p) => p.id), true)
                          .then(() => flash(`Paiement de ${prenom(m?.name ?? "")} confirmé`))
                          .catch((e) => flash("Erreur : " + e.message))
                      }
                    >
                      <Check size={16} strokeWidth={2.25} /> Reçu
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
          </div>
        )}

        {g.type !== "collecte" && (
          <Card className="space-y-2 text-sm">
            {ben && (
              <div className="flex items-center gap-3">
                <Avatar name={ben.name} size={36} />
                <div className="flex-1">
                  <p className="text-xs text-stone-500">Bénéficiaire de ce tour</p>
                  <p className="font-bold">{ben.name}{ben.id === me?.id && " (toi)"}</p>
                </div>
                <span className="font-bold text-emerald-700">{fcfa(st.expected)}</span>
              </div>
            )}
            {versementTour && (
              <div className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-200">
                <CheckCircle2 size={16} strokeWidth={2} className="mr-1 inline -mt-0.5" />Caisse versée à <b>{versementTour.beneficiaryName}</b> : {fcfa(versementTour.amount)} ({METHOD_LABEL[versementTour.method]}, {dateCourte(versementTour.date)})
              </div>
            )}
            <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${late ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-700"}`}>
              <span className="inline-flex items-center gap-1.5"><CalendarDays size={16} strokeWidth={1.75} />Échéance : <b>{dateCourte(dueDate(g, g.currentRound).toISOString())}</b></span>
              {late && g.penalty > 0 && <span className="text-xs font-semibold">+{fcfa(g.penalty)} de pénalité</span>}
            </div>
          </Card>
        )}

        {g.paymentPhoneChangedAt && Date.now() - new Date(g.paymentPhoneChangedAt).getTime() < 14 * 24 * 3600 * 1000 && (
          <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-200">
            <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-900">
              <b>Le numéro de réception a été modifié</b> le {dateLongue(g.paymentPhoneChangedAt)}. Nouveau numéro : <b>{telAffiche(g.paymentPhone ?? "")}</b>.
              Avant de payer, vérifie que le nom affiché dans Wave est bien celui du trésorier.
            </p>
          </div>
        )}

        {g.description && <p className="px-1 text-sm leading-relaxed text-stone-600">{g.description}</p>}

        {termine && (
          <Card className="space-y-2 border-stone-300 bg-stone-50">
            <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={Flag} taille="sm" />Ce groupe est terminé</p>
            <p className="text-xs text-stone-600">
              {g.type === "collecte" ? "La date limite de la collecte est passée." : "Tous les tours ont été versés."}
              {userId && g.createdBy === userId ? " Tu peux garder le groupe pour l’historique, ou le supprimer." : ""}
            </p>
            {userId && g.createdBy === userId && (
              <Link href={`/groupes/${g.id}/parametres#supprimer`} className={btnClass("secondary", "w-full !text-red-600")}>
                Supprimer le groupe
              </Link>
            )}
          </Card>
        )}

        {/* Actions */}
        <div className="space-y-2">
          {me && mesArrieres.length > 0 && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("primary", "w-full text-base !bg-red-600 hover:!bg-red-700")}>
              Régler mes arriérés ({mesArrieres.length} tour{mesArrieres.length > 1 ? "s" : ""})
            </Link>
          )}
          {me && mesDeclarations.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
              <Clock size={16} strokeWidth={2} className="mr-1 inline -mt-0.5" />Ton paiement de {fcfa(sum(mesDeclarations))} est en attente de confirmation{tresorier ? ` par ${prenom(tresorier.name)}` : ""}
              <button
                type="button"
                onClick={() => {
                  if (!confirm(`Annuler ta déclaration de ${fcfa(sum(mesDeclarations))} ? Fais-le seulement si tu t’es trompé (montant, tour) ou si tu n’as pas encore envoyé l’argent.`)) return;
                  annulerDeclaration(mesDeclarations.map((p) => p.id))
                    .then(() => flash("Déclaration annulée"))
                    .catch((e) => flash("Impossible d’annuler : " + e.message));
                }}
                className="mt-1.5 block w-full text-xs font-semibold text-amber-900 underline underline-offset-2"
              >
                Je me suis trompé : annuler ma déclaration
              </button>
            </div>
          )}
          {me && mesArrieres.length === 0 && myStatus !== "paye" && !(tourEnAttente && g.type !== "collecte") && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("primary", "w-full text-base")}>
              {g.type === "collecte" ? "Participer" : `Payer ma part · ${fcfa(due.total)}`}
            </Link>
          )}
          {me && mesArrieres.length === 0 && myStatus === "retard" && due.penalty > 0 && !(tourEnAttente && g.type !== "collecte") && (
            <p className="-mt-1 text-center text-xs font-semibold text-red-600">En retard : pénalité de {fcfa(due.penalty)} incluse dans le montant</p>
          )}
          {me && myStatus === "paye" && g.type !== "collecte" && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 size={16} strokeWidth={2} className="mr-1 inline -mt-0.5" />{paidUntil(g, me.id) > g.currentRound ? `Tu as payé jusqu’au tour ${paidUntil(g, me.id)}` : "Tu as payé ta part pour ce tour"}
              {peutAvancer && mesArrieres.length === 0 && (
                <Link href={`/groupes/${g.id}/payer`} className="mt-1 block text-xs font-semibold text-emerald-800 underline">Payer des tours en avance</Link>
              )}
            </div>
          )}
          {me && myStatus === "paye" && g.type === "collecte" && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("secondary", "w-full")}>Ajouter une participation</Link>
          )}
          {/* Actions rapides, façon application bancaire */}
          <div className="grid grid-cols-4 gap-1 pt-1">
            <ActionRapide
              label={g.type === "collecte" ? "Partager" : "Relancer"}
              badge={g.type !== "collecte" && unpaid.length > 0 ? unpaid.length : undefined}
              disabled={g.type !== "collecte" && unpaid.length === 0}
              onClick={() => setMsg({ type: "groupe" })}
            >
              <WhatsAppIcon size={20} />
            </ActionRapide>
            <ActionRapide label="Inviter" href={invitation(g, { cle: cleInvit, par: userId })}>
              <UserPlus size={20} strokeWidth={1.75} />
            </ActionRapide>
            <ActionRapide label="Historique" onClick={() => setTab("historique")}>
              <History size={20} strokeWidth={1.75} />
            </ActionRapide>
            {dr.gestionnaire ? (
              <ActionRapide label="Réglages" href={`/groupes/${g.id}/parametres`} interne>
                <Settings size={20} strokeWidth={1.75} />
              </ActionRapide>
            ) : (
              <ActionRapide label="Membres" onClick={() => setTab("membres")}>
                <Users size={20} strokeWidth={1.75} />
              </ActionRapide>
            )}
          </div>
        </div>

        <Reglement g={g} mesParts={g.members.filter((m) => !!userId && m.profileId === userId)} />

        <Tirage g={g} tresorier={isTreasurer} onVoirOrdre={() => setTab("tours")} />

        <CaissePenalites g={g} tresorier={isTreasurer} />


        {/* Onglets */}
        <div className="flex gap-1 rounded-xl bg-stone-200/70 p-1 text-sm font-semibold">
          {(["membres", "historique", ...(g.type === "tontine" ? ["tours"] : [])] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-2 capitalize transition ${tab === t ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"}`}>
              {t === "membres" ? `Membres (${g.members.length})` : t}
            </button>
          ))}
        </div>

        {tab === "membres" && (
          <Card className="divide-y divide-stone-100 !p-0">
            {sortedMembers.map((m) => {
              const s = memberStatus(g, m.id);
              const paid = sum(paymentsOf(g, m.id));
              return (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {m.name}
                      {m.id === me?.id && <span className="text-stone-400"> (toi)</span>}
                    </p>
                    <p className="text-xs text-stone-500">
                      {m.role !== "membre" && (
                        <span className={`mr-1.5 rounded-md px-1.5 py-0.5 text-[0.75rem] font-bold uppercase ${m.role === "tresorier" ? "bg-orange-100 text-orange-700" : "bg-sky-100 text-sky-700"}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      )}
                      {(dr.gestionnaire || m.id === me?.id) && <span className="whitespace-nowrap">{telAffiche(m.phone)}</span>}{paid > 0 && g.type === "collecte" && ` · ${fcfa(paid)}`}
                    </p>
                    {g.type !== "collecte" && paidUntil(g, m.id) > g.currentRound && (
                      <p className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-emerald-700"><ChevronsRight size={12} strokeWidth={2.25} />Payé jusqu’au tour {paidUntil(g, m.id)}</p>
                    )}
                    {s === "retard" && g.type !== "collecte" && !g.pending.some((p) => p.memberId === m.id) && (
                      <p className="text-[0.8125rem] font-semibold text-red-600">Doit {fcfa(due.total)}{due.penalty > 0 ? ` (dont ${fcfa(due.penalty)} de pénalité)` : ""}</p>
                    )}
                    {g.pending.some((p) => p.memberId === m.id) && (
                      <button type="button" onClick={voirConfirmation} className="inline-flex items-center gap-1 text-left text-[0.8125rem] font-semibold text-amber-700 underline decoration-amber-300 underline-offset-2"><Clock size={12} strokeWidth={2} />{isTreasurer ? "Paiement déclaré : confirmer" : "Paiement déclaré, à confirmer"}</button>
                    )}
                    {arrears(g, m.id).length > 0 && (
                      <p className="text-[0.8125rem] font-semibold text-red-600">Doit : tour{arrears(g, m.id).length > 1 ? "s" : ""} {arrears(g, m.id).join(", ")}</p>
                    )}
                    {g.type !== "collecte" && dr.gestionnaire && (
                      <p className={`text-[0.8125rem] font-semibold ${!m.profileId ? "text-stone-400" : g.engagements.some((e) => e.profileId === m.profileId) ? "text-emerald-700" : "text-amber-700"}`}>
                        {!m.profileId ? "Pas encore inscrit" : g.engagements.some((e) => e.profileId === m.profileId) ? "Règlement accepté" : "Règlement pas encore accepté"}
                      </p>
                    )}
                    {g.type !== "collecte" && impayes(g, m.id).length > 0 && (dr.gestionnaire || m.profileId === userId) && (
                      <Link href={`/groupes/${g.id}/dette/${m.id}`} className="mt-1 inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[0.8125rem] font-semibold text-red-700 ring-1 ring-red-100">
                        <FileText size={12} strokeWidth={2} /> Reconnaissance de dette
                      </Link>
                    )}
                    {m.id !== me?.id && m.profileId !== userId && m.phone && (
                      <div className="mt-1.5 flex gap-1.5">
                        <a href={`tel:${m.phone.replace(/\D/g, "").slice(-10)}`} className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-[0.8125rem] font-semibold text-stone-700">
                          <Phone size={12} strokeWidth={2} /> Appeler
                        </a>
                        <a href={waLink("", m.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-[0.8125rem] font-semibold text-stone-700">
                          <MessageCircle size={12} strokeWidth={2} /> Écrire
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {s === "a_confirmer" ? (
                      <button type="button" onClick={voirConfirmation} aria-label={isTreasurer ? "Confirmer ce paiement" : "Paiement à confirmer"} className="transition active:scale-95">
                        <StatusBadge status={s} />
                      </button>
                    ) : (
                      <StatusBadge status={s} />
                    )}
                    {s !== "paye" && m.id !== me?.id && m.profileId && m.profileId === userId && g.type !== "collecte" && (
                      <Link href={`/groupes/${g.id}/payer?membre=${m.id}`} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">Payer</Link>
                    )}
                    {s !== "paye" && m.id !== me?.id && m.profileId !== userId && (
                      <div className="flex gap-1">
                        <button onClick={() => setMsg({ type: "relance", member: m })} title="Relancer sur WhatsApp" className="rounded-lg bg-[#25D366]/10 p-1.5 text-[#128C7E] hover:bg-[#25D366]/20">
                          <WhatsAppIcon size={16} />
                        </button>
                        {isTreasurer && g.type !== "collecte" && (
                          <button
                            onClick={() => {
                              if (confirm(`Confirmer que ${m.name} a payé ${fcfa(due.total)} en espèces ?`)) {
                                recordPayment(g.id, m.id, "especes")
                                  .then(() => flash(`Paiement de ${prenom(m.name)} enregistré`))
                                  .catch((e) => flash("Erreur : " + e.message));
                              }
                            }}
                            className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-200"
                          >
                            Espèces
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!dr.peutAjouter && (
              <p className="bg-stone-50/60 p-4 text-xs text-stone-500">
                Seul{g.addPolicy === "gestionnaires" ? "s le trésorier et les co-gestionnaires peuvent" : " le trésorier peut"} ajouter des membres. Utilise « Inviter » pour partager le lien du groupe.
              </p>
            )}
            {dr.peutAjouter && (
            <form
              className="space-y-2 bg-stone-50/60 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                const n = newName;
                addMember(g.id, newName, newPhone, g.type === "tontine" ? newParts : 1)
                  .then(() => flash(`${prenom(n)} ajouté(e) au groupe`))
                  .catch((err) => flash("Erreur : " + err.message));
                setNewName("");
                setNewPhone("");
                setNewParts(1);
              }}
            >
              <p className="text-sm font-semibold text-stone-700">Ajouter un membre</p>
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <input className={inputClass} placeholder="Nom" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className={inputClass} placeholder="Téléphone" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              {g.type === "tontine" && (
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-stone-500">Nombre de parts (bras) :</span>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => setNewParts(n)} className={`h-7 w-7 rounded-full text-xs font-bold ring-1 ${newParts === n ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-stone-700 ring-stone-300"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <Button type="submit" variant="secondary" className="w-full !py-2.5">Ajouter</Button>
            </form>
            )}
          </Card>
        )}

        {tab === "historique" && (
          <Card className="divide-y divide-stone-100 !p-0">
            {g.payments.length === 0 && <p className="p-4 text-center text-sm text-stone-500">Aucun paiement pour l’instant.</p>}
            {[...g.payouts].reverse().map((v) => (
              <div key={v.id} className="flex items-center gap-3 bg-amber-50/50 px-4 py-3">
                <IconBadge icon={ArrowUpRight} ton="ambre" taille="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{NATURE_LABEL[v.nature ?? "versement"]} {v.beneficiaryName}</p>
                  <p className="text-xs text-stone-500">
                    {dateLongue(v.date)} · {METHOD_LABEL[v.method]}{g.type === "tontine" && ` · Tour ${v.round}`}{v.note && ` · ${v.note}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-amber-700">−{fcfa(v.amount)}</p>
              </div>
            ))}
            {[...g.payments].reverse().map((p) => {
              const m = [...g.members, ...g.anciens].find((x) => x.id === p.memberId);
              return (
                <Link key={p.id} href={`/groupes/${g.id}/recu/${p.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50">
                  <Avatar name={m?.name ?? "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{m?.name ?? "Ancien membre"}</p>
                    <p className="text-xs text-stone-500">
                      {dateLongue(p.date)} · {METHOD_LABEL[p.method]}{g.type !== "collecte" && ` · Tour ${p.round}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-700">+{fcfa(p.amount + p.penalty)}</p>
                    {p.penalty > 0 && <p className="text-[0.8125rem] text-red-600">dont {fcfa(p.penalty)} pénalité</p>}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}

        {tab === "tours" && g.type === "tontine" && (
          <Card className="divide-y divide-stone-100 !p-0">
            <p className="px-4 py-2.5 text-xs text-stone-500">
              {g.tirageFait ? `Ordre tiré au sort le ${dateLongue(g.tirageFait)} par ${g.tiragePar ?? "le trésorier"}.` : "Ordre fixé par le trésorier."}
            </p>
            {g.order.map((mid, i) => {
              const m = g.members.find((x) => x.id === mid);
              const r = i + 1;
              const etat = r < g.currentRound ? "passe" : r === g.currentRound ? "actuel" : "futur";
              return (
                <div key={mid} className={`flex items-center gap-3 px-4 py-3 ${etat === "actuel" ? "bg-emerald-50" : ""}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${etat === "passe" ? "bg-stone-200 text-stone-500" : etat === "actuel" ? "bg-emerald-600 text-white" : "bg-stone-100 text-stone-600"}`}>
                    {r}
                  </span>
                  <div className="flex-1">
                    <p className={`font-semibold ${etat === "passe" ? "text-stone-400" : ""}`}>{m?.name ?? "—"}</p>
                    <p className="text-xs text-stone-500">{dateCourte(dueDate(g, r).toISOString())}</p>
                  </div>
                  <span className="text-xs font-semibold text-stone-500">
                    {etat === "passe" ? <span className="inline-flex items-center gap-1"><Check size={13} strokeWidth={2.25} />A reçu</span> : etat === "actuel" ? <span className="inline-flex items-center gap-1 text-emerald-700"><Gift size={13} strokeWidth={2} />Ce tour</span> : fcfa(g.amount * g.members.length)}
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {isTreasurer && MODE_PAIEMENT === "manuel" && (
          <Card className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={Smartphone} taille="sm" />Numéro qui reçoit les cotisations</p>
            {numero === null ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-stone-700">
                  <b>{telAffiche(g.paymentPhone || tresorier?.phone || "")}</b>
                  <span className="block text-xs text-stone-500">Les membres envoient leur argent à ce numéro (Wave, Orange Money…).</span>
                </p>
                <button onClick={() => setNumero(telAffiche(g.paymentPhone || tresorier?.phone || ""))} className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-700">
                  Modifier
                </button>
              </div>
            ) : (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (numero.replace(/\D/g, "").length < 10) return flash("Le numéro doit avoir 10 chiffres");
                  setPaymentPhone(g.id, numero)
                    .then(() => {
                      setNumero(null);
                      flash("Numéro enregistré");
                    })
                    .catch((err) => flash("Erreur : " + err.message));
                }}
              >
                <input className={inputClass} inputMode="tel" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="07 07 12 34 56" />
                <Button type="submit" className="shrink-0 !px-4">OK</Button>
              </form>
            )}
          </Card>
        )}

        {isTreasurer && g.type === "tontine" && !versementTour && ben && netTour > 0 && (
          <Card className={`space-y-2 ${unpaid.length === 0 ? "border-emerald-300 bg-emerald-50/60" : ""}`}>
            <p className="flex items-center gap-2 text-sm font-bold"><IconBadge icon={unpaid.length === 0 ? PartyPopper : ArrowUpRight} ton={unpaid.length === 0 ? "vert" : "gris"} taille="sm" />{unpaid.length === 0 ? "Tout le monde a payé" : "Verser la caisse"}</p>
            <p className="text-xs text-stone-600">
              {unpaid.length === 0
                ? `La caisse du tour ${g.currentRound} est complète. Verse ${fcfa(netTour)} à ${ben.name}.`
                : `Il manque encore ${unpaid.length} paiement(s). Tu peux attendre, ou verser dès maintenant ce qui a été reçu (${fcfa(netTour)}).`}
            </p>
            <Button variant={unpaid.length === 0 ? "primary" : "secondary"} className="w-full" disabled={enValidation.length > 0} onClick={() => setVersement(true)}>
              {enValidation.length > 0 ? "Versement en cours de validation" : `Verser ${fcfa(netTour)} à ${prenom(ben.name)}`}
            </Button>
          </Card>
        )}

        {isTreasurer && g.type !== "tontine" && cs.solde > 0 && (
          <Card className="space-y-2">
            <p className="text-sm font-bold">{g.type === "collecte" ? "Remettre les fonds" : "Sortie de caisse"}</p>
            <p className="text-xs text-stone-600">
              Solde disponible : <b>{fcfa(cs.solde)}</b> (frais Mobile Money déduits).
              {g.type === "collecte" ? " Remets l’argent à la personne désignée, puis enregistre-le ici." : " Enregistre chaque dépense de l’association pour que tout le monde la voie."}
            </p>
            <Button variant="secondary" className="w-full" disabled={enValidation.length > 0} onClick={() => setVersement(true)}>
              {enValidation.length > 0 ? "Versement en cours de validation" : g.type === "collecte" ? "Enregistrer la remise des fonds" : "Enregistrer une sortie"}
            </Button>
          </Card>
        )}

        {isTreasurer && g.type !== "collecte" && (
          <Card className="space-y-2 border-dashed">
            <p className="text-sm font-bold">Espace trésorier</p>
            <p className="text-xs text-stone-500">
              {finished
                ? "C’est le dernier tour du cycle. Tout le monde aura reçu sa part."
                : unpaid.length > 0
                  ? `Il reste ${unpaid.length} paiement(s) avant de clôturer ce tour.`
                  : "Tout le monde a payé. Tu peux clôturer le tour."}
            </p>
            {!finished && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  if (unpaid.length === 0 || confirm(`${unpaid.length} membre(s) n’ont pas encore payé. Clôturer quand même ?`)) {
                    const next = g.currentRound + 1;
                    nextRound(g.id)
                      .then(() => flash(`Tour ${next} ouvert`))
                      .catch((err) => flash("Erreur : " + err.message));
                    setTab("membres");
                  }
                }}
              >
                Clôturer le tour {g.currentRound} et passer au suivant
              </Button>
            )}
          </Card>
        )}

        {/* Quitter ou supprimer le groupe */}
        <div className="pt-2 text-center">
          {userId && g.createdBy === userId ? (
            <Link href={`/groupes/${g.id}/parametres#supprimer`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600">
              <Trash2 size={15} strokeWidth={2} /> Supprimer le groupe
            </Link>
          ) : me && !isTreasurer ? (
            <button
              type="button"
              onClick={async () => {
                if (!confirm(`Quitter « ${g.name} » ? Tu ne verras plus ce groupe. Si tu as déjà payé, ton historique reste visible pour les autres membres.`)) return;
                try {
                  await quitterGroupe(g.id);
                  router.replace("/groupes");
                } catch (e) {
                  flash("Impossible de quitter : " + (e as Error).message);
                }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600"
            >
              <LogOut size={15} strokeWidth={2} /> Quitter le groupe
            </button>
          ) : null}
        </div>
      </div>

      {versement && (
        <PayoutModal
          titre={g.type === "tontine" ? `Versement du tour ${g.currentRound}` : g.type === "collecte" ? "Remise des fonds" : "Sortie de caisse"}
          beneficiaire={g.type === "tontine" ? ben?.name ?? "" : ""}
          nomModifiable={g.type !== "tontine"}
          montant={g.type === "tontine" ? netTour : cs.solde}
          max={g.type === "tontine" ? Math.min(netTour, cs.solde) : cs.solde}
          onClose={() => setVersement(false)}
          onConfirm={async (v) => {
            const r = await recordPayout(g.id, { ...v, round: g.currentRound, memberId: g.type === "tontine" ? ben?.id : null });
            flash(r.statut === "valide" ? "Versement enregistré" : `Demande envoyée : ${r.requis - 1} autre(s) validation(s) nécessaire(s)`);
          }}
        />
      )}

      {msg && <MessageModal group={g} member={msg.member} type={msg.type} onClose={() => setMsg(null)} />}

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-20 mx-auto w-fit max-w-[90%] rounded-full bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </Page>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div className="py-3">
      <p className={`text-xl font-extrabold ${cls}`}>{n}</p>
      <p className="text-[0.8125rem] font-medium text-stone-500">{label}</p>
    </div>
  );
}
