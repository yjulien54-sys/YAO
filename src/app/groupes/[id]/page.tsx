"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, Button, Card, Header, Loading, Page, Progress, StatusBadge, WhatsAppIcon, btnClass, inputClass, useRequireUser } from "@/components/ui";
import { dateCourte, dateLongue, fcfa, prenom, telAffiche } from "@/lib/format";
import { TYPE_LABEL, amountDue, arrears, beneficiary, caisse, dueDate, isLate, memberStatus, netDuTour, paidUntil, payoutFor, paymentsOf, roundStats, roundsToPay, sum, unpaidMembers } from "@/lib/logic";
import { PayoutModal } from "@/components/PayoutModal";
import { METHOD_LABEL, MODE_PAIEMENT } from "@/lib/payments";
import { useMe, useStore } from "@/lib/store";
import { invitation } from "@/lib/whatsapp";
import { MessageModal } from "@/components/MessageModal";
import type { Member } from "@/lib/types";

type Tab = "membres" | "historique" | "tours";

export default function GroupeDetail() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const { getGroup, recordPayment, recordPayout, confirmPayments, setPaymentPhone, addMember, nextRound, joinGroup, loaded } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  const [tab, setTab] = useState<Tab>("membres");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [toast, setToast] = useState("");
  const [msg, setMsg] = useState<{ type: "relance" | "groupe"; member?: Member } | null>(null);
  const [versement, setVersement] = useState(false);
  const [numero, setNumero] = useState<string | null>(null);

  if (!ok || !loaded) return <Loading />;
  if (!g) return <Invitation id={id} onJoin={() => joinGroup(id)} />;

  const st = roundStats(g);
  const ben = beneficiary(g);
  const late = isLate(g, g.currentRound);
  const due = amountDue(g);
  const isTreasurer = me?.role === "tresorier";
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
  const tourEnAttente = me ? mesDeclarations.some((p) => p.round === g.currentRound || g.type === "collecte") : false;
  const tresorier = g.members.find((m) => m.role === "tresorier");

  const flash = (t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 2500);
  };

  const sortedMembers = [...g.members].sort((a, b) => {
    const rank = { retard: 0, attente: 1, paye: 2 };
    return rank[memberStatus(g, a.id)] - rank[memberStatus(g, b.id)];
  });

  return (
    <Page>
      <Header back="/groupes" title={g.name} />

      <div className="space-y-4 p-4">
        {/* Résumé */}
        <Card className="overflow-hidden !p-0">
          <div className="bg-gradient-to-br from-emerald-700 to-emerald-600 p-4 text-white">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-emerald-100">
              <span>{TYPE_LABEL[g.type]}</span>
              {g.type !== "collecte" && <span>Tour {g.currentRound}{g.type === "tontine" && ` sur ${g.order.length}`}</span>}
            </div>
            <p className="mt-2 text-sm text-emerald-100">{g.type === "collecte" ? "Collecté" : "Dans la caisse du tour"}</p>
            <p className="text-3xl font-extrabold">{fcfa(st.collected)}</p>
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
          <div className="grid grid-cols-3 divide-x divide-stone-200 text-center">
            <Stat n={st.counts.paye} label="Payé" cls="text-emerald-700" />
            <Stat n={st.counts.attente} label="En attente" cls="text-amber-600" />
            <Stat n={st.counts.retard} label="En retard" cls="text-red-600" />
          </div>
        </Card>

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
                ✅ Caisse versée à <b>{versementTour.beneficiaryName}</b> : {fcfa(versementTour.amount)} ({METHOD_LABEL[versementTour.method]}, {dateCourte(versementTour.date)})
              </div>
            )}
            <div className={`flex items-center justify-between rounded-xl px-3 py-2 ${late ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-700"}`}>
              <span>📅 Échéance : <b>{dateCourte(dueDate(g, g.currentRound).toISOString())}</b></span>
              {late && g.penalty > 0 && <span className="text-xs font-semibold">+{fcfa(g.penalty)} de pénalité</span>}
            </div>
          </Card>
        )}

        {g.description && <p className="px-1 text-sm leading-relaxed text-stone-600">{g.description}</p>}

        {/* Actions */}
        <div className="space-y-2">
          {me && mesArrieres.length > 0 && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("primary", "w-full text-base !bg-red-600 hover:!bg-red-700")}>
              Régler mes arriérés ({mesArrieres.length} tour{mesArrieres.length > 1 ? "s" : ""})
            </Link>
          )}
          {me && mesDeclarations.length > 0 && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-center text-sm font-semibold text-amber-800 ring-1 ring-amber-200">
              ⏳ Ton paiement de {fcfa(sum(mesDeclarations))} est en attente de confirmation{tresorier ? ` par ${prenom(tresorier.name)}` : ""}
            </div>
          )}
          {me && mesArrieres.length === 0 && myStatus !== "paye" && !(tourEnAttente && g.type !== "collecte") && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("primary", "w-full text-base")}>
              {g.type === "collecte" ? "Participer" : `Payer ma part · ${fcfa(due.total)}`}
            </Link>
          )}
          {me && myStatus === "paye" && g.type !== "collecte" && (
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
              ✅ {paidUntil(g, me.id) > g.currentRound ? `Tu as payé jusqu’au tour ${paidUntil(g, me.id)}` : "Tu as payé ta part pour ce tour"}
              {peutAvancer && mesArrieres.length === 0 && (
                <Link href={`/groupes/${g.id}/payer`} className="mt-1 block text-xs font-semibold text-emerald-800 underline">Payer des tours en avance</Link>
              )}
            </div>
          )}
          {me && myStatus === "paye" && g.type === "collecte" && (
            <Link href={`/groupes/${g.id}/payer`} className={btnClass("secondary", "w-full")}>Ajouter une participation</Link>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMsg({ type: "groupe" })} disabled={g.type !== "collecte" && unpaid.length === 0} className={btnClass("whatsapp", "disabled:opacity-50")}>
              <WhatsAppIcon /> {g.type === "collecte" ? "Partager l’appel" : `Relancer (${unpaid.length})`}
            </button>
            <a href={invitation(g)} target="_blank" rel="noreferrer" className={btnClass("secondary")}>
              Inviter
            </a>
          </div>
        </div>

        {isTreasurer && declarations.length > 0 && (
          <Card className="space-y-3 border-amber-300 bg-amber-50/60">
            <div>
              <p className="text-sm font-bold">⏳ Paiements à confirmer ({declarations.length})</p>
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
                    <p className="shrink-0 font-extrabold">{fcfa(sum(d))}</p>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="secondary"
                      className="!py-2"
                      onClick={() => {
                        if (confirm(`Refuser ce paiement de ${m?.name} ? (argent non reçu)`))
                          confirmPayments(d.map((p) => p.id), false).then(() => flash("Paiement refusé")).catch((e) => flash("Erreur : " + e.message));
                      }}
                    >
                      Pas reçu
                    </Button>
                    <Button
                      className="!py-2"
                      onClick={() =>
                        confirmPayments(d.map((p) => p.id), true)
                          .then(() => flash(`Paiement de ${prenom(m?.name ?? "")} confirmé ✅`))
                          .catch((e) => flash("Erreur : " + e.message))
                      }
                    >
                      Reçu ✓
                    </Button>
                  </div>
                </div>
              );
            })}
          </Card>
        )}

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
                      {m.role === "tresorier" && <span className="ml-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-orange-700">Trésorier</span>}
                    </p>
                    <p className="text-xs text-stone-500">{telAffiche(m.phone)}{paid > 0 && g.type === "collecte" && ` · ${fcfa(paid)}`}</p>
                    {g.type !== "collecte" && paidUntil(g, m.id) > g.currentRound && (
                      <p className="text-[11px] font-semibold text-emerald-700">⏩ Payé jusqu’au tour {paidUntil(g, m.id)}</p>
                    )}
                    {g.pending.some((p) => p.memberId === m.id) && (
                      <p className="text-[11px] font-semibold text-amber-700">⏳ Paiement déclaré, à confirmer</p>
                    )}
                    {arrears(g, m.id).length > 0 && (
                      <p className="text-[11px] font-semibold text-red-600">Doit : tour{arrears(g, m.id).length > 1 ? "s" : ""} {arrears(g, m.id).join(", ")}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <StatusBadge status={s} />
                    {s !== "paye" && m.id !== me?.id && (
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
            <form
              className="space-y-2 bg-stone-50/60 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newName.trim()) return;
                const n = newName;
                addMember(g.id, newName, newPhone)
                  .then(() => flash(`${prenom(n)} ajouté(e) au groupe`))
                  .catch((err) => flash("Erreur : " + err.message));
                setNewName("");
                setNewPhone("");
              }}
            >
              <p className="text-sm font-semibold text-stone-700">Ajouter un membre</p>
              <div className="grid grid-cols-[1fr_8.5rem] gap-2">
                <input className={inputClass} placeholder="Nom" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input className={inputClass} placeholder="Téléphone" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary" className="w-full !py-2.5">Ajouter</Button>
            </form>
          </Card>
        )}

        {tab === "historique" && (
          <Card className="divide-y divide-stone-100 !p-0">
            {g.payments.length === 0 && <p className="p-4 text-center text-sm text-stone-500">Aucun paiement pour l’instant.</p>}
            {[...g.payouts].reverse().map((v) => (
              <div key={v.id} className="flex items-center gap-3 bg-amber-50/50 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-100 text-base">📤</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Versé à {v.beneficiaryName}</p>
                  <p className="text-xs text-stone-500">
                    {dateLongue(v.date)} · {METHOD_LABEL[v.method]}{g.type === "tontine" && ` · Tour ${v.round}`}{v.note && ` · ${v.note}`}
                  </p>
                </div>
                <p className="text-sm font-bold text-amber-700">−{fcfa(v.amount)}</p>
              </div>
            ))}
            {[...g.payments].reverse().map((p) => {
              const m = g.members.find((x) => x.id === p.memberId);
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
                    {p.penalty > 0 && <p className="text-[11px] text-red-600">dont {fcfa(p.penalty)} pénalité</p>}
                  </div>
                </Link>
              );
            })}
          </Card>
        )}

        {tab === "tours" && g.type === "tontine" && (
          <Card className="divide-y divide-stone-100 !p-0">
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
                    {etat === "passe" ? "✓ A reçu" : etat === "actuel" ? "🎁 Ce tour" : fcfa(g.amount * g.members.length)}
                  </span>
                </div>
              );
            })}
          </Card>
        )}

        {isTreasurer && MODE_PAIEMENT === "manuel" && (
          <Card className="space-y-2">
            <p className="text-sm font-bold">📲 Numéro qui reçoit les cotisations</p>
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
                      flash("Numéro enregistré ✅");
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
            <p className="text-sm font-bold">{unpaid.length === 0 ? "🎉 Tout le monde a payé !" : "Verser la caisse"}</p>
            <p className="text-xs text-stone-600">
              {unpaid.length === 0
                ? `La caisse du tour ${g.currentRound} est complète. Verse ${fcfa(netTour)} à ${ben.name}.`
                : `Il manque encore ${unpaid.length} paiement(s). Tu peux attendre, ou verser dès maintenant ce qui a été reçu (${fcfa(netTour)}).`}
            </p>
            <Button variant={unpaid.length === 0 ? "primary" : "secondary"} className="w-full" onClick={() => setVersement(true)}>
              Verser {fcfa(netTour)} à {prenom(ben.name)}
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
            <Button variant="secondary" className="w-full" onClick={() => setVersement(true)}>
              {g.type === "collecte" ? "Enregistrer la remise des fonds" : "Enregistrer une sortie"}
            </Button>
          </Card>
        )}

        {isTreasurer && g.type !== "collecte" && (
          <Card className="space-y-2 border-dashed">
            <p className="text-sm font-bold">Espace trésorier</p>
            <p className="text-xs text-stone-500">
              {finished
                ? "C’est le dernier tour du cycle. Tout le monde aura reçu sa part 🎉"
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
            await recordPayout(g.id, { ...v, round: g.currentRound, memberId: g.type === "tontine" ? ben?.id : null });
            flash("Versement enregistré ✅");
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
      <p className="text-[11px] font-medium text-stone-500">{label}</p>
    </div>
  );
}

const TYPE_NOM: Record<string, string> = { tontine: "la tontine", association: "l’association", collecte: "la collecte" };

function Invitation({ id, onJoin }: { id: string; onJoin: () => Promise<void> }) {
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
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-emerald-100 text-4xl">🤝</div>
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

