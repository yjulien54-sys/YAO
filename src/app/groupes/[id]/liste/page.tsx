"use client";

/**
 * Liste des paiements d'un groupe, pour le trésorier et les co-gestionnaires :
 * qui a payé, combien, qui n'a pas encore payé, avec les totaux.
 * À partager sur WhatsApp, à enregistrer en PDF (impression) ou à ouvrir dans Excel.
 */
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Phone, PhoneOff } from "lucide-react";
import { Loading, WhatsAppIcon, useRequireUser } from "@/components/ui";
import { dateCourte, fcfa, telAffiche } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments";
import { droits, memberStatus, sum } from "@/lib/logic";
import { useMe, useStore } from "@/lib/store";
import type { Group, Member, MemberStatus, Payment } from "@/lib/types";

type Ligne = {
  m: Member;
  ancien: boolean;
  statut: MemberStatus | null; // null pour une collecte
  ceTour: number; // payé pour le tour en cours (tontine / association)
  total: number; // tout ce que la personne a payé
  nb: number; // nombre de paiements
  dernier?: Payment;
  aConfirmer: number; // montant déclaré, pas encore confirmé
};

const STATUT: Record<MemberStatus, { l: string; c: string; e: string }> = {
  paye: { l: "Payé", c: "bg-emerald-100 text-emerald-800", e: "✅" },
  a_confirmer: { l: "À confirmer", c: "bg-amber-100 text-amber-800", e: "⏳" },
  attente: { l: "Pas encore", c: "bg-stone-100 text-stone-600", e: "⬜" },
  retard: { l: "En retard", c: "bg-red-100 text-red-700", e: "❌" },
};
const TYPE: Record<Group["type"], string> = { tontine: "Tontine", association: "Association", collecte: "Collecte" };

function lignesDe(g: Group): Ligne[] {
  const faire = (m: Member, ancien: boolean): Ligne => {
    const ps = g.payments.filter((p) => p.memberId === m.id).sort((a, b) => b.date.localeCompare(a.date));
    return {
      m, ancien,
      statut: g.type === "collecte" || ancien ? null : memberStatus(g, m.id),
      ceTour: sum(ps.filter((p) => p.round === g.currentRound)),
      total: sum(ps),
      nb: ps.length,
      dernier: ps[0],
      aConfirmer: sum(g.pending.filter((p) => p.memberId === m.id)),
    };
  };
  return [
    ...g.members.map((m) => faire(m, false)),
    // Anciens membres : seulement s'ils ont payé quelque chose (pour que les comptes soient justes)
    ...g.anciens.map((m) => faire(m, true)).filter((l) => l.total > 0),
  ];
}

const aPaye = (l: Ligne, collecte: boolean) => (collecte ? l.total > 0 : l.statut === "paye");

export default function ListePaiements() {
  const ok = useRequireUser();
  const { id } = useParams<{ id: string }>();
  const { getGroup, loaded, userId } = useStore();
  const g = getGroup(id);
  const me = useMe(g);
  const [filtre, setFiltre] = useState<"tous" | "payes" | "non">("tous");
  const [numeros, setNumeros] = useState(false);

  const lignes = useMemo(() => (g ? lignesDe(g) : []), [g]);
  if (!ok || !loaded) return <Loading />;
  if (!g) return <p className="p-8 text-center text-stone-500">Groupe introuvable.</p>;
  const dr = droits(g, me, userId);
  if (!dr.gestionnaire) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <p className="font-bold">Réservé au trésorier</p>
        <p className="mt-1 text-sm text-stone-600">Seuls le trésorier et les co-gestionnaires peuvent télécharger la liste des paiements.</p>
        <Link href={`/groupes/${g.id}`} className="mt-4 inline-block font-semibold text-emerald-700 underline">Retour au groupe</Link>
      </div>
    );
  }

  const collecte = g.type === "collecte";
  const visibles = lignes.filter((l) => filtre === "tous" || (filtre === "payes" ? aPaye(l, collecte) : !aPaye(l, collecte)));
  const actifs = lignes.filter((l) => !l.ancien);
  const nbPayes = actifs.filter((l) => aPaye(l, collecte)).length;
  const totalEncaisse = sum(g.payments);
  const totalTour = sum(g.payments.filter((p) => p.round === g.currentRound));
  const attenduTour = g.amount * g.members.length;
  const enAttente = sum(g.pending);
  const aujourdHui = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const tresorier = g.members.find((m) => m.role === "tresorier");

  // ---------- Partage WhatsApp ----------
  const texteWhatsApp = () => {
    const nomL = (l: Ligne) => `${l.m.name}${l.ancien ? " (retiré)" : ""}${numeros && l.m.phone ? ` · ${telAffiche(l.m.phone)}` : ""}`;
    const lignesTxt: string[] = [`*Liste des paiements — ${g.name}*`, `${TYPE[g.type]}${collecte ? "" : ` · Tour ${g.currentRound}`} · ${aujourdHui}`, ""];
    if (collecte) {
      const donateurs = lignes.filter((l) => l.total > 0).sort((a, b) => b.total - a.total);
      lignesTxt.push(`✅ *Ont participé (${donateurs.length})*`);
      donateurs.forEach((l, i) => lignesTxt.push(`${i + 1}. ${nomL(l)} — ${fcfa(l.total)}`));
      const rien = actifs.filter((l) => l.total === 0);
      if (rien.length) { lignesTxt.push("", `⬜ *Pas encore participé (${rien.length})*`); rien.forEach((l, i) => lignesTxt.push(`${i + 1}. ${nomL(l)}`)); }
      lignesTxt.push("", `💰 *Total collecté : ${fcfa(totalEncaisse)}*${g.target ? ` sur ${fcfa(g.target)}` : ""}`);
    } else {
      (["paye", "a_confirmer", "retard", "attente"] as MemberStatus[]).forEach((s) => {
        const ls = actifs.filter((l) => l.statut === s);
        if (!ls.length) return;
        lignesTxt.push(`${STATUT[s].e} *${s === "paye" ? "Ont payé" : s === "a_confirmer" ? "À confirmer" : s === "retard" ? "En retard" : "Pas encore payé"} (${ls.length})*`);
        ls.forEach((l, i) => lignesTxt.push(`${i + 1}. ${nomL(l)}${s === "paye" ? ` — ${fcfa(l.ceTour)}` : s === "a_confirmer" ? ` — ${fcfa(l.aConfirmer)}` : ""}`));
        lignesTxt.push("");
      });
      lignesTxt.push(`💰 *Tour ${g.currentRound} : ${fcfa(totalTour)}* sur ${fcfa(attenduTour)} (${nbPayes}/${actifs.length} ont payé)`);
      lignesTxt.push(`Total encaissé depuis le début : ${fcfa(totalEncaisse)}`);
    }
    lignesTxt.push("", "_Liste générée avec Cotiz_");
    return lignesTxt.join("\n");
  };

  // ---------- Excel (CSV lisible par Excel, séparateur « ; ») ----------
  const telechargerExcel = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const entete = ["N°", "Membre", ...(numeros ? ["Téléphone"] : []), ...(collecte ? [] : ["Statut tour " + g.currentRound, "Payé ce tour (F)"]), "Total payé (F)", "Nombre de paiements", "Dernier paiement", "Moyen", "À confirmer (F)"];
    const rows = visibles.map((l, i) => [
      i + 1, l.m.name + (l.ancien ? " (retiré)" : ""), ...(numeros ? [l.m.phone ? telAffiche(l.m.phone) : ""] : []),
      ...(collecte ? [] : [l.statut ? STATUT[l.statut].l : "Retiré", l.ceTour]),
      l.total, l.nb, l.dernier ? dateCourte(l.dernier.date) : "", l.dernier ? METHOD_LABEL[l.dernier.method] : "", l.aConfirmer,
    ]);
    const total = ["", "TOTAL", ...(numeros ? [""] : []), ...(collecte ? [] : ["", visibles.reduce((s, l) => s + l.ceTour, 0)]), visibles.reduce((s, l) => s + l.total, 0), visibles.reduce((s, l) => s + l.nb, 0), "", "", visibles.reduce((s, l) => s + l.aConfirmer, 0)];
    const csv = "﻿" + [[`Liste des paiements — ${g.name} — ${aujourdHui}`], entete, ...rows, total].map((r) => r.map(esc).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `paiements-${g.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <div className="min-h-dvh bg-[#f7f5f0] print:bg-white">
      {/* Barre d'actions (cachée à l'impression) */}
      <div className="sticky top-0 z-10 border-b border-stone-200/70 bg-[#f7f5f0]/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link href={`/groupes/${g.id}`} className="grid h-10 w-10 place-items-center rounded-full bg-white shadow-sm ring-1 ring-stone-200" aria-label="Retour"><ArrowLeft size={18} /></Link>
          <h1 className="flex-1 truncate font-bold">Liste des paiements</h1>
        </div>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 p-4 print:max-w-none print:p-0">
        {/* Boutons */}
        <div className="grid grid-cols-3 gap-2 print:hidden">
          <a href={`https://wa.me/?text=${encodeURIComponent(texteWhatsApp())}`} target="_blank" rel="noopener" className="flex flex-col items-center gap-1.5 rounded-2xl bg-[#1fa855] px-2 py-3 text-center text-xs font-bold text-white shadow-sm">
            <WhatsAppIcon size={22} /> Partager sur WhatsApp
          </a>
          <button type="button" onClick={() => window.print()} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center text-xs font-bold text-stone-800 shadow-sm ring-1 ring-stone-200">
            <FileText size={22} className="text-red-600" /> Télécharger en PDF
          </button>
          <button type="button" onClick={telechargerExcel} className="flex flex-col items-center gap-1.5 rounded-2xl bg-white px-2 py-3 text-center text-xs font-bold text-stone-800 shadow-sm ring-1 ring-stone-200">
            <FileSpreadsheet size={22} className="text-emerald-700" /> Télécharger Excel
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {([["tous", "Tous"], ["payes", collecte ? "Ont participé" : "Ont payé"], ["non", collecte ? "Pas encore" : "N’ont pas payé"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFiltre(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filtre === k ? "bg-emerald-700 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"}`}>{l}</button>
          ))}
          <button onClick={() => setNumeros(!numeros)} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-stone-600 ring-1 ring-stone-200">
            {numeros ? <Phone size={14} /> : <PhoneOff size={14} />} {numeros ? "Numéros affichés" : "Numéros cachés"}
          </button>
        </div>
        <p className="text-xs text-stone-500 print:hidden">PDF : choisissez « Enregistrer en PDF » dans la fenêtre qui s’ouvre. Les numéros de téléphone ne sont ajoutés que si vous les affichez.</p>

        {/* Le document */}
        <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200 print:rounded-none print:shadow-none print:ring-0">
          <div className="h-1.5 bg-gradient-to-r from-[#009e60] via-[#f5c400] to-[#f77f00]" />
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#f77f00]">{TYPE[g.type]}{collecte ? "" : ` · Tour ${g.currentRound}`}</p>
              <h2 className="mt-1 text-xl font-extrabold leading-tight text-[#0b3d2c]">{g.name}</h2>
              <p className="mt-1 text-sm text-stone-500">Liste des paiements au {aujourdHui}{tresorier ? ` · Trésorier : ${tresorier.name}` : ""}</p>
            </div>
            <span className="flex shrink-0 items-center gap-2 font-extrabold text-[#0b3d2c]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-[11px]" /> Cotiz
            </span>
          </div>

          {/* Résumé */}
          <div className="grid grid-cols-2 gap-px border-y border-stone-100 bg-stone-100 sm:grid-cols-4">
            {(collecte
              ? [["Total collecté", fcfa(totalEncaisse)], ["Objectif", g.target ? fcfa(g.target) : "—"], ["Participants", `${nbPayes} / ${actifs.length}`], ["À confirmer", fcfa(enAttente)]]
              : [["Ce tour", `${fcfa(totalTour)}`], ["Attendu", fcfa(attenduTour)], ["Ont payé", `${nbPayes} / ${actifs.length}`], ["Total encaissé", fcfa(totalEncaisse)]]
            ).map(([l, v]) => (
              <div key={l} className="bg-white px-4 py-3">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-stone-500">{l}</p>
                <p className="mt-0.5 text-lg font-extrabold tabular-nums text-stone-900">{v}</p>
              </div>
            ))}
          </div>

          {/* Tableau */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.8125rem] sm:text-sm">
              <thead>
                <tr className="bg-stone-50 text-[0.7rem] uppercase tracking-wide text-stone-500">
                  <th className="hidden px-2 py-2.5 font-semibold sm:table-cell sm:px-3 print:table-cell">N°</th>
                  <th className="px-2 py-2.5 sm:px-3 font-semibold">Membre</th>
                  {!collecte && <th className="px-2 py-2.5 sm:px-3 font-semibold">Statut</th>}
                  {!collecte && <th className="hidden px-2 py-2.5 text-right font-semibold sm:table-cell sm:px-3 print:table-cell">Ce tour</th>}
                  <th className="whitespace-nowrap px-2 py-2.5 text-right font-semibold sm:px-3">Total payé</th>
                  <th className="hidden px-2 py-2.5 sm:px-3 font-semibold sm:table-cell print:table-cell">Dernier paiement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {visibles.map((l, i) => (
                  <tr key={l.m.id} className="break-inside-avoid">
                    <td className="hidden px-2 py-2.5 tabular-nums text-stone-400 sm:table-cell sm:px-3 print:table-cell">{i + 1}</td>
                    <td className="px-2 py-2.5 sm:px-3">
                      <p className="font-semibold text-stone-900">{l.m.name}{l.ancien && <span className="ml-1 text-xs font-normal text-stone-400">(retiré)</span>}</p>
                      {numeros && l.m.phone && <p className="text-xs tabular-nums text-stone-500">{telAffiche(l.m.phone)}</p>}
                      {l.aConfirmer > 0 && <p className="text-xs text-amber-700">{fcfa(l.aConfirmer)} à confirmer</p>}
                    </td>
                    {!collecte && (
                      <td className="px-2 py-2.5 sm:px-3">
                        {l.statut ? <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${STATUT[l.statut].c}`}>{STATUT[l.statut].l}</span> : <span className="text-xs text-stone-400">—</span>}
                        {l.ceTour > 0 && <span className="mt-0.5 block whitespace-nowrap text-xs font-semibold tabular-nums text-stone-600 sm:hidden print:hidden">{fcfa(l.ceTour)}</span>}
                      </td>
                    )}
                    {!collecte && <td className="hidden whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums sm:table-cell sm:px-3 print:table-cell">{l.ceTour ? fcfa(l.ceTour) : "—"}</td>}
                    <td className="px-2 py-2.5 sm:px-3 whitespace-nowrap text-right font-bold tabular-nums text-[#0b3d2c]">{l.total ? fcfa(l.total) : "—"}</td>
                    <td className="hidden px-2 py-2.5 sm:px-3 text-xs text-stone-500 sm:table-cell print:table-cell">{l.dernier ? `${dateCourte(l.dernier.date)} · ${METHOD_LABEL[l.dernier.method]}` : "—"}</td>
                  </tr>
                ))}
                {!visibles.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-stone-400">Personne dans cette liste.</td></tr>}
              </tbody>
              <tfoot>
                <tr className="bg-[#0b3d2c] text-white">
                  <td className="hidden px-2 py-3 sm:table-cell sm:px-3 print:table-cell" />
                  <td className="px-2 py-3 font-bold sm:px-3">Total ({visibles.length})</td>
                  {!collecte && <td className="px-2 py-3 sm:px-3"><span className="whitespace-nowrap text-xs font-bold tabular-nums sm:hidden print:hidden">{fcfa(visibles.reduce((s, l) => s + l.ceTour, 0))}</span></td>}
                  {!collecte && <td className="hidden whitespace-nowrap px-2 py-3 text-right font-bold tabular-nums sm:table-cell sm:px-3 print:table-cell">{fcfa(visibles.reduce((s, l) => s + l.ceTour, 0))}</td>}
                  <td className="px-2 py-3 sm:px-3 whitespace-nowrap text-right font-extrabold tabular-nums">{fcfa(visibles.reduce((s, l) => s + l.total, 0))}</td>
                  <td className="hidden px-2 py-3 sm:px-3 sm:table-cell print:table-cell" />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="flex flex-col gap-1 px-5 py-3 text-[0.7rem] text-stone-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Montants confirmés par le trésorier. Les paiements « à confirmer » ne sont pas comptés dans les totaux.</span>
            <span className="inline-flex shrink-0 items-center gap-1"><Download size={11} /> tontine-et-cotise.vercel.app</span>
          </p>
        </article>
      </div>
    </div>
  );
}
