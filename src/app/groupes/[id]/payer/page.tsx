"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Card, Field, Header, Loading, Page, inputClass, useRequireUser } from "@/components/ui";
import { fcfa, prenom, telAffiche } from "@/lib/format";
import { amountDue, memberStatus } from "@/lib/logic";
import { OPERATEURS, initierPaiement } from "@/lib/payments";
import { useMe, useStore } from "@/lib/store";
import type { PayMethod } from "@/lib/types";

const RAPIDES = [2000, 5000, 10000, 25000];

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
  const { getGroup, recordPayment, loaded } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  const member = g?.members.find((m) => m.id === search.get("membre")) ?? me;

  const [method, setMethod] = useState<Exclude<PayMethod, "especes">>("wave");
  const [phone, setPhone] = useState(member ? telAffiche(member.phone) : "");
  const [montant, setMontant] = useState("10000");
  const [etat, setEtat] = useState<"form" | "attente">("form");

  if (!ok || !loaded) return <Loading />;
  if (!g || !member)
    return (
      <Page>
        <Header back="/groupes" title="Paiement" />
        <p className="p-6 text-center text-stone-500">Groupe ou membre introuvable.</p>
      </Page>
    );

  const due = amountDue(g);
  const total = g.type === "collecte" ? Number(montant) || 0 : due.total;
  const dejaPaye = g.type !== "collecte" && memberStatus(g, member.id) === "paye";
  const op = OPERATEURS.find((o) => o.id === method)!;
  const pourAutrui = member.id !== me?.id;

  async function payer() {
    setEtat("attente");
    try {
      await initierPaiement({ method, phone, amount: total });
      const p = await recordPayment(g!.id, member!.id, method, total);
      router.replace(`/groupes/${g!.id}/recu/${p.id}?nouveau=1`);
    } catch (err) {
      alert("Le paiement n’a pas pu être enregistré : " + (err as Error).message);
      setEtat("form");
    }
  }

  if (etat === "attente")
    return (
      <Page>
        <div className="grid min-h-dvh place-items-center p-8 text-center">
          <div>
            <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-full text-2xl font-extrabold animate-pulse" style={{ background: op.bg, color: op.fg }}>
              {op.nom[0]}
            </div>
            <h2 className="text-xl font-bold">Confirme sur ton téléphone</h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Une demande de paiement de <b>{fcfa(total)}</b> a été envoyée au {phone} via {op.nom}.
              <br />Valide avec ton code secret.
            </p>
            <div className="mx-auto mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-stone-200">
              <div className="h-full w-1/2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-blue-500" />
            </div>
            <p className="mt-6 text-xs text-stone-400">Démo : le paiement est simulé</p>
          </div>
        </div>
      </Page>
    );

  return (
    <Page>
      <Header back={`/groupes/${g.id}`} title={g.type === "collecte" ? "Participer" : "Payer la cotisation"} />
      <div className="space-y-4 p-4">
        <Card>
          <p className="text-sm text-stone-500">{g.name}</p>
          {pourAutrui && <p className="mt-1 text-sm">Pour <b>{member.name}</b></p>}
          {g.type === "collecte" ? (
            <div className="mt-3 space-y-3">
              <Field label="Montant de ta participation (F CFA)">
                <input className={`${inputClass} text-2xl font-extrabold`} inputMode="numeric" value={montant} onChange={(e) => setMontant(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <div className="flex flex-wrap gap-2">
                {RAPIDES.map((r) => (
                  <button key={r} type="button" onClick={() => setMontant(String(r))} className={`rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ${Number(montant) === r ? "bg-blue-600 text-white ring-blue-600" : "bg-white text-stone-700 ring-stone-300"}`}>
                    {fcfa(r)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-stone-600">Cotisation tour {g.currentRound}</span><span className="font-semibold">{fcfa(due.base)}</span></div>
              {due.penalty > 0 && <div className="flex justify-between text-red-600"><span>Pénalité de retard</span><span className="font-semibold">{fcfa(due.penalty)}</span></div>}
              <div className="flex justify-between border-t border-stone-200 pt-2 text-base"><span className="font-bold">Total</span><span className="text-2xl font-extrabold">{fcfa(total)}</span></div>
            </div>
          )}
        </Card>

        {dejaPaye ? (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200">
            ✅ {pourAutrui ? `${prenom(member.name)} a` : "Tu as"} déjà payé pour ce tour
          </div>
        ) : (
          <>
            <div>
              <p className="mb-2 px-1 text-sm font-semibold text-stone-700">Moyen de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {OPERATEURS.map((o) => (
                  <button key={o.id} type="button" onClick={() => setMethod(o.id)}
                    className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white p-3 text-left text-sm font-bold transition ${method === o.id ? "border-blue-500" : "border-stone-200"}`}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-base font-extrabold" style={{ background: o.bg, color: o.fg }}>{o.nom[0]}</span>
                    {o.nom}
                  </button>
                ))}
              </div>
            </div>
            <Field label={`Numéro ${op.nom}`}>
              <input className={inputClass} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button className="w-full text-base" disabled={total <= 0 || phone.replace(/\D/g, "").length < 10} onClick={payer}>
              Payer {fcfa(total)} avec {op.nom}
            </Button>
            <p className="text-center text-xs text-stone-500">🔒 L’argent va directement sur le compte du groupe. Reçu envoyé à tous.</p>
          </>
        )}
      </div>
    </Page>
  );
}
