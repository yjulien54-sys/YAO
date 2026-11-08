"use client";

import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import { Button, Header, Loading, Page, WhatsAppIcon, btnClass, useRequireUser } from "@/components/ui";
import { dateCourte, dateLongue, fcfa, telAffiche } from "@/lib/format";
import { TYPE_LABEL, droits, dueDate, impayes, isLate } from "@/lib/logic";
import { METHOD_LABEL } from "@/lib/payments";
import { useMe, useStore } from "@/lib/store";
import { waLink } from "@/lib/whatsapp";

export default function DettePage() {
  const ok = useRequireUser();
  const { id, mid } = useParams<{ id: string; mid: string }>();
  const { getGroup, loaded, userId } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  if (!ok || !loaded) return <Loading />;
  const m = g?.members.find((x) => x.id === mid);
  if (!g || !m)
    return (
      <Page>
        <Header back="/groupes" title="Reconnaissance de dette" />
        <p className="p-6 text-center text-stone-500">Membre introuvable.</p>
      </Page>
    );
  const d = droits(g, me, userId);
  if (!d.gestionnaire && m.profileId !== userId)
    return (
      <Page>
        <Header back={`/groupes/${g.id}`} title="Reconnaissance de dette" />
        <p className="p-6 text-center text-sm text-stone-500">Seuls le trésorier, les co-gestionnaires et le membre concerné peuvent voir ce document.</p>
      </Page>
    );

  const tours = impayes(g, m.id).map((r) => {
    const penalite = isLate(g, r) ? g.penalty : 0;
    return { r, echeance: dueDate(g, r).toISOString(), cotisation: g.amount, penalite, total: g.amount + penalite };
  });
  const total = tours.reduce((s, t) => s + t.total, 0);
  const recus = g.payouts.filter((v) => v.memberId === m.id && v.status !== "echoue");
  const paiements = g.payments.filter((p) => p.memberId === m.id);
  const engagement = m.profileId ? g.engagements.find((e) => e.profileId === m.profileId) : undefined;
  const tresorier = g.members.find((x) => x.role === "tresorier");
  const lien = typeof window !== "undefined" ? `${window.location.origin}/groupes/${g.id}/dette/${m.id}` : "";
  const message = `Bonjour ${m.name},\n\nSelon l’historique du groupe « ${g.name} » sur Cotiz, ${tours.length} cotisation(s) restent impayées, pour un total de *${fcfa(total)}*.${recus.length ? ` Pour rappel, tu as reçu la caisse le ${dateCourte(recus[0].date)}.` : ""}\n\nMerci de régulariser rapidement. Le détail est ici :\n${lien}`;

  return (
    <Page>
      <div className="print:hidden">
        <Header back={`/groupes/${g.id}`} title="Reconnaissance de dette" />
      </div>
      <div className="space-y-4 p-4 print:p-0">
        <article className="carte space-y-4 p-5 text-[14px] leading-relaxed text-stone-800 print:border-0 print:shadow-none">
          <header className="border-b border-stone-200 pb-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Cotiz · {TYPE_LABEL[g.type]}</p>
            <h1 className="mt-1 text-xl font-extrabold">Reconnaissance de dette</h1>
            <p className="text-xs text-stone-500">Groupe « {g.name} »</p>
          </header>

          <p>
            Je soussigné(e) <b>{m.name}</b>, joignable au <b>{telAffiche(m.phone)}</b>, membre du groupe « {g.name} »
            {tresorier ? <> dont le trésorier est {tresorier.name} ({telAffiche(tresorier.phone)})</> : null}, reconnais devoir au groupe la somme de{" "}
            <b>{fcfa(total)}</b>, correspondant aux cotisations impayées détaillées ci-dessous.
          </p>

          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-stone-200 text-xs text-stone-500">
                <th className="py-1.5">Tour</th>
                <th>Échéance</th>
                <th className="text-right">Cotisation</th>
                <th className="text-right">Pénalité</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((t) => (
                <tr key={t.r} className="border-b border-stone-100">
                  <td className="py-1.5">{t.r}</td>
                  <td>{dateCourte(t.echeance)}</td>
                  <td className="text-right">{fcfa(t.cotisation)}</td>
                  <td className="text-right">{t.penalite ? fcfa(t.penalite) : "—"}</td>
                  <td className="text-right font-semibold">{fcfa(t.total)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className="pt-2 text-right font-bold">Total dû</td>
                <td className="pt-2 text-right text-base font-extrabold">{fcfa(total)}</td>
              </tr>
            </tbody>
          </table>

          <section>
            <h2 className="text-sm font-bold">Sommes déjà reçues du groupe</h2>
            {recus.length ? (
              <ul className="mt-1 list-disc pl-5">
                {recus.map((v) => (
                  <li key={v.id}>
                    Caisse du tour {v.round} reçue le {dateLongue(v.date)} : <b>{fcfa(v.amount)}</b> ({METHOD_LABEL[v.method]}, réf. {v.reference})
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-stone-600">Aucune caisse reçue à ce jour.</p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold">Paiements déjà effectués</h2>
            <p className="text-stone-600">
              {paiements.length} paiement(s), pour un total de {fcfa(paiements.reduce((s, p) => s + p.amount + p.penalty, 0))}.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold">Engagement</h2>
            {engagement ? (
              <>
                <p className="text-stone-600">
                  Règlement accepté dans l’application Cotiz le <b>{dateLongue(engagement.acceptedAt)}</b> par {engagement.nom} ({telAffiche(engagement.telephone)}) :
                </p>
                <p className="mt-1 whitespace-pre-line rounded-xl bg-stone-50 p-3 text-[12.5px] text-stone-700 ring-1 ring-stone-200">{engagement.texte}</p>
              </>
            ) : (
              <p className="text-stone-600">Le membre n’a pas accepté le règlement dans l’application.</p>
            )}
          </section>

          <section className="space-y-6 pt-2 text-xs text-stone-500">
            <p>Fait à ……………………………… le ………………………</p>
            <div className="grid grid-cols-2 gap-6">
              <div className="border-t border-stone-300 pt-1">Signature du membre</div>
              <div className="border-t border-stone-300 pt-1">Signature du trésorier</div>
            </div>
          </section>

          <footer className="border-t border-stone-200 pt-3 text-[11px] leading-snug text-stone-500">
            Document généré le {dateLongue(new Date().toISOString())} par Cotiz à partir de l’historique enregistré du groupe. Il récapitule les informations
            enregistrées et peut servir de preuve ; il ne remplace pas un acte établi par un professionnel du droit.
          </footer>
        </article>

        <div className="grid gap-2 print:hidden">
          <Button onClick={() => window.print()}>
            <Printer size={18} /> Imprimer ou enregistrer en PDF
          </Button>
          {d.gestionnaire && m.profileId !== userId && (
            <a href={waLink(message, m.phone)} target="_blank" rel="noreferrer" className={btnClass("whatsapp")}>
              <WhatsAppIcon /> Envoyer à {m.name} sur WhatsApp
            </a>
          )}
        </div>
      </div>
    </Page>
  );
}
