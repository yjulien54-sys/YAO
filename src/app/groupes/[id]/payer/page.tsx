"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Header, Loading, Page, WhatsAppIcon, btnClass, inputClass, useRequireUser } from "@/components/ui";
import { dateCourte, fcfa, prenom, telAffiche } from "@/lib/format";
import { dueDate, roundAmount, roundsToPay } from "@/lib/logic";
import { FRAIS_TAUX, MODE_PAIEMENT, OPERATEURS, initierPaiement } from "@/lib/payments";
import { useMe, useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { waLink } from "@/lib/whatsapp";
import type { PayMethod } from "@/lib/types";

const RAPIDES = [2000, 5000, 10000, 25000];

/** Ouverture de l'application de paiement du membre (mode paiement direct au trésorier) */
const APPS: Record<string, { android?: string; store?: string; ussd?: string; label: string }> = {
  wave: {
    label: "Ouvrir Wave et payer",
    android: "intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.wave.personal;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.wave.personal;end",
  },
  orange: { label: "Payer avec Orange Money (#144#)", ussd: "#144#" },
  mtn: { label: "Payer avec MTN MoMo (*133#)", ussd: "*133#" },
  moov: { label: "Payer avec Moov Money (*155#)", ussd: "*155#" },
};

export default function PayerPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Payer />
    </Suspense>
  );
}

function Payer() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const { getGroup, recordPayments, declarePayments, loaded } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  const member = g?.members.find((m) => m.id === search.get("membre")) ?? me;

  const [method, setMethod] = useState<Exclude<PayMethod, "especes">>("wave");
  const [phone, setPhone] = useState(member ? telAffiche(member.phone) : "");
  const [montant, setMontant] = useState("10000");
  const [nb, setNb] = useState(1);
  const [etat, setEtat] = useState<"form" | "attente" | "declare">("form");
  const [refWave, setRefWave] = useState("");
  const [copie, setCopie] = useState(false);
  const [aide, setAide] = useState("");
  const [erreur, setErreur] = useState("");

  if (!ok || !loaded) return <Loading />;
  if (!g || !member)
    return (
      <Page>
        <Header back="/groupes" title="Paiement" />
        <p className="p-6 text-center text-stone-500">Groupe ou membre introuvable.</p>
      </Page>
    );

  const isCollecte = g.type === "collecte";
  const enAttente = g.pending.filter((p) => p.memberId === member.id);
  const aPayer = roundsToPay(g, member.id).filter((r) => !enAttente.some((p) => p.round === r));
  const tresorier = g.members.find((m) => m.role === "tresorier");
  const numeroCaisse = g.paymentPhone || tresorier?.phone || "";
  const jeSuisTresorier = me?.role === "tresorier";
  const choix = aPayer.slice(0, Math.min(aPayer.length, 6));
  const tours = choix.slice(0, nb);
  const lignes = tours.map((r) => ({ r, ...roundAmount(g, r) }));
  const total = isCollecte ? Number(montant) || 0 : lignes.reduce((s, l) => s + l.total, 0);
  const rienAPayer = !isCollecte && aPayer.length === 0;
  const operateurs = MODE_PAIEMENT === "wave" ? OPERATEURS.filter((o) => o.id === "wave") : OPERATEURS;
  const op = operateurs.find((o) => o.id === method) ?? operateurs[0];
  const pourAutrui = member.id !== me?.id;

  async function payer() {
    setErreur("");
    if (MODE_PAIEMENT === "manuel") {
      try {
        if (jeSuisTresorier) {
          // le trésorier enregistre un paiement qu'il a lui-même reçu
          const ps = await recordPayments(g!.id, member!.id, method, isCollecte ? { amount: total } : { rounds: tours });
          router.replace(`/groupes/${g!.id}/recu/${ps[0].id}?nouveau=1${ps.length > 1 ? `&n=${ps.length}` : ""}`);
        } else {
          await declarePayments(g!.id, member!.id, method, isCollecte ? { amount: total, ref: refWave } : { rounds: tours, ref: refWave });
          setEtat("declare");
        }
      } catch (err) {
        setErreur("Impossible d’enregistrer : " + (err as Error).message);
      }
      return;
    }
    setEtat("attente");
    try {
      if (MODE_PAIEMENT !== "simulation") {
        const { data } = await supabase.auth.getSession();
        const res = await fetch("/api/paiements/initier", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
          body: JSON.stringify({ groupId: g!.id, memberId: member!.id, rounds: tours, amount: isCollecte ? total : undefined, phone }),
        });
        const json = await res.json();
        if (!res.ok || !json.paymentUrl) throw new Error(json.error ?? "paiement impossible");
        window.location.href = json.paymentUrl; // page sécurisée Wave / CinetPay
        return;
      }
      await initierPaiement({ method, phone, amount: total });
      const ps = await recordPayments(g!.id, member!.id, method, isCollecte ? { amount: total } : { rounds: tours });
      router.replace(`/groupes/${g!.id}/recu/${ps[0].id}?nouveau=1${ps.length > 1 ? `&n=${ps.length}` : ""}`);
    } catch (err) {
      setErreur("Le paiement n’a pas pu être fait : " + (err as Error).message);
      setEtat("form");
    }
  }

  if (etat === "declare")
    return (
      <Page>
        <div className="grid min-h-dvh place-items-center p-6 text-center">
          <div className="w-full space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl">⏳</div>
            <h2 className="text-xl font-extrabold">Paiement déclaré !</h2>
            <p className="text-sm leading-relaxed text-stone-600">
              {tresorier ? prenom(tresorier.name) : "Le trésorier"} va vérifier qu’il a bien reçu <b>{fcfa(total)}</b>, puis confirmer.
              Tu passeras alors en « Payé » et tu recevras ton reçu.
            </p>
            {tresorier && (
              <a
                href={waLink(`Bonjour ${prenom(tresorier.name)} 👋\n\nJe viens d’envoyer ${fcfa(total)} par ${op.nom} pour « ${g.name} »${refWave ? ` (réf. ${refWave})` : ""}.\n\nMerci de confirmer dans Cotiz 🙏\n${typeof window !== "undefined" ? window.location.origin : ""}/groupes/${g.id}`, tresorier.phone)}
                target="_blank"
                rel="noreferrer"
                className={btnClass("whatsapp", "w-full")}
              >
                <WhatsAppIcon /> Prévenir {prenom(tresorier.name)} sur WhatsApp
              </a>
            )}
            <Link href={`/groupes/${g.id}`} className={btnClass("secondary", "w-full")}>Retour au groupe</Link>
          </div>
        </div>
      </Page>
    );

  if (etat === "attente")
    return (
      <Page>
        <div className="grid min-h-dvh place-items-center p-8 text-center">
          <div>
            <div className="mx-auto mb-6 grid h-20 w-20 animate-pulse place-items-center rounded-full text-2xl font-extrabold" style={{ background: op.bg, color: op.fg }}>
              {op.nom[0]}
            </div>
            <h2 className="text-xl font-bold">{MODE_PAIEMENT === "wave" ? "Ouverture de Wave…" : MODE_PAIEMENT === "cinetpay" ? "Ouverture du paiement sécurisé…" : "Confirme sur ton téléphone"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Paiement de <b>{fcfa(total)}</b> via {op.nom}.
              {MODE_PAIEMENT === "simulation" && <><br />Valide avec ton code secret.</>}
            </p>
            {MODE_PAIEMENT === "simulation" && <p className="mt-6 text-xs text-stone-400">Mode test : le paiement est simulé, aucun argent n’est prélevé</p>}
          </div>
        </div>
      </Page>
    );

  return (
    <Page>
      <Header back={`/groupes/${g.id}`} title={isCollecte ? "Participer" : "Payer la cotisation"} />
      <div className="space-y-4 p-4">
        {MODE_PAIEMENT === "simulation" && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Mode test : les paiements sont simulés, aucun argent n’est prélevé.
          </p>
        )}
        {enAttente.length > 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            ⏳ {enAttente.length} paiement(s) déjà déclaré(s), en attente de confirmation du trésorier.
          </p>
        )}
        <Card>
          <p className="text-sm text-stone-500">{g.name}</p>
          {pourAutrui && <p className="mt-1 text-sm">Pour <b>{member.name}</b></p>}
          {isCollecte ? (
            <div className="mt-3 space-y-3">
              <Field label="Montant de ta participation (F CFA)">
                <input className={`${inputClass} text-2xl font-extrabold`} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {RAPIDES.map((r) => (
                  <button key={r} type="button" onClick={() => setMontant(String(r))} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${Number(montant) === r ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-stone-700 ring-stone-300"}`}>
                    {fcfa(r)}
                  </button>
                ))}
              </div>
            </div>
          ) : rienAPayer ? (
            <p className="mt-2 text-sm font-semibold text-emerald-700">✅ Tout est payé jusqu’au dernier tour possible.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {choix.length > 1 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-stone-700">Combien de tours veux-tu payer ?</p>
                  <div className="flex flex-wrap gap-2">
                    {choix.map((_, i) => (
                      <button key={i} type="button" onClick={() => setNb(i + 1)} className={`min-w-11 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${nb === i + 1 ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-stone-700 ring-stone-300"}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                  {nb > 1 && <p className="mt-2 text-xs text-stone-500">Paiement en avance : chaque part sera versée au bénéficiaire du tour correspondant.</p>}
                </div>
              )}
              <div className="space-y-1 text-sm">
                {lignes.map((l) => (
                  <div key={l.r}>
                    <div className="flex justify-between">
                      <span className="text-stone-600">
                        Tour {l.r} <span className="text-xs text-stone-400">· {dateCourte(dueDate(g, l.r).toISOString())}</span>
                        {l.r < g.currentRound && <span className="ml-1 text-xs font-semibold text-red-600">(arriéré)</span>}
                      </span>
                      <span className="font-semibold">{fcfa(l.base)}</span>
                    </div>
                    {l.penalty > 0 && (
                      <div className="flex justify-between text-red-600"><span className="pl-3">Pénalité de retard</span><span className="font-semibold">{fcfa(l.penalty)}</span></div>
                    )}
                  </div>
                ))}
                <div className="flex justify-between border-t border-stone-200 pt-2 text-base"><span className="font-bold">Total</span><span className="text-2xl font-extrabold">{fcfa(total)}</span></div>
              </div>
            </div>
          )}
        </Card>

        {!rienAPayer && (
          <>
            <div>
              <p className="mb-2 px-1 text-sm font-semibold text-stone-700">{MODE_PAIEMENT === "manuel" ? "Avec quelle application paies-tu ?" : "Moyen de paiement"}</p>
              <div className="grid grid-cols-2 gap-2">
                {operateurs.map((o) => (
                  <button key={o.id} type="button" onClick={() => setMethod(o.id)} className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white p-3 text-left text-sm font-bold transition ${method === o.id ? "border-emerald-500" : "border-stone-200"}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-extrabold" style={{ background: o.bg, color: o.fg }}>{o.nom[0]}</span>
                    {o.nom}
                  </button>
                ))}
              </div>
            </div>
            {MODE_PAIEMENT === "manuel" && !jeSuisTresorier && (
              <Card className="space-y-3 border-emerald-300 bg-emerald-50/50">
                <p className="text-sm font-bold">1. Envoie l’argent à {tresorier ? prenom(tresorier.name) : "la caisse"}</p>
                <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-xs text-stone-500">Montant à envoyer</p>
                      <p className="text-3xl font-extrabold tracking-tight">{fcfa(total)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2">
                    <div>
                      <p className="text-xs text-stone-500">Numéro {op.nom} du trésorier{tresorier ? ` (${tresorier.name})` : ""}</p>
                      <p className="text-lg font-extrabold tracking-wide">{numeroCaisse ? telAffiche(numeroCaisse) : "—"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(numeroCaisse.replace(/\D/g, "").slice(-10)).then(() => {
                          setCopie(true);
                          setTimeout(() => setCopie(false), 2000);
                        });
                      }}
                      className="rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700"
                    >
                      {copie ? "Copié ✓" : "Copier"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const num = numeroCaisse.replace(/\D/g, "").slice(-10);
                    try {
                      await navigator.clipboard?.writeText(num);
                    } catch {}
                    const app = APPS[method];
                    const android = /android/i.test(navigator.userAgent);
                    if (app.ussd) {
                      setAide(`Numéro copié ✓ Dans le menu, choisis « Transfert », colle le numéro ${telAffiche(num)} et envoie ${fcfa(total)}.`);
                      window.location.href = `tel:${encodeURIComponent(app.ussd)}`;
                    } else if (android && app.android) {
                      setAide(`Numéro copié ✓ Dans Wave, choisis « Envoyer », colle le numéro ${telAffiche(num)} et envoie ${fcfa(total)}.`);
                      window.location.href = app.android;
                    } else {
                      setAide(`Numéro copié ✓ Ouvre ton application ${op.nom}, choisis « Envoyer », colle le numéro ${telAffiche(num)} et envoie ${fcfa(total)}.`);
                    }
                  }}
                  className={btnClass(method === "wave" ? "primary" : "secondary", `w-full ${method === "wave" ? "!from-[#3dd0ff] !to-[#1aa9e6] !shadow-sky-900/20" : ""}`)}
                >
                  {APPS[method].label} →
                </button>
                {aide && <p className="rounded-xl bg-white px-3 py-2 text-xs font-medium text-stone-700 ring-1 ring-stone-200">{aide}</p>}
                <p className="text-sm font-bold">2. Reviens ici et confirme</p>
                <Field label="Référence de la transaction (facultatif)" hint="Elle se trouve dans le SMS ou l’historique de ton application. Elle aide le trésorier à vérifier.">
                  <input className={inputClass} value={refWave} onChange={(e) => setRefWave(e.target.value)} placeholder="ex : T_ABC123…" />
                </Field>
              </Card>
            )}
            {MODE_PAIEMENT === "manuel" ? null : MODE_PAIEMENT === "wave" ? (
              <p className="px-1 text-sm text-stone-600">Tu vas être redirigé vers <b>Wave</b> pour valider le paiement, puis tu reviendras automatiquement sur Cotiz.</p>
            ) : (
              <Field label={`Numéro ${op.nom}`}>
                <input className={inputClass} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            )}
            {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
            <Button className="w-full text-base" disabled={total <= 0 || (MODE_PAIEMENT !== "wave" && MODE_PAIEMENT !== "manuel" && phone.replace(/\D/g, "").length < 10)} onClick={payer}>
              {MODE_PAIEMENT === "manuel"
                ? jeSuisTresorier
                  ? `Enregistrer le paiement de ${fcfa(total)} (reçu par ${op.nom})`
                  : `J’ai envoyé ${fcfa(total)} par ${op.nom}`
                : `Payer ${fcfa(total)} avec ${op.nom}`}
            </Button>
            <p className="text-center text-xs leading-relaxed text-stone-500">
              {MODE_PAIEMENT === "manuel"
                ? "🔒 Ton paiement sera validé par le trésorier après vérification. Tout le groupe verra le reçu."
                : `🔒 Tu paies exactement ${fcfa(total)}. Les frais (≈${Math.round(FRAIS_TAUX * 100)} %) sont pris sur la caisse du groupe.`}
              {MODE_PAIEMENT !== "manuel" && !pourAutrui ? ` Reçu visible par tout le groupe.` : ""}
            </p>
          </>
        )}
      </div>
    </Page>
  );
}
