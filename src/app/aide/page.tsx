import type { Metadata } from "next";
import Link from "next/link";
import { CircleHelp, KeyRound, Smartphone, Users, Wallet } from "lucide-react";
import { ServiceClient } from "@/components/ServiceClient";
import { RequeteClient } from "@/components/RequeteClient";
import { BottomNav } from "@/components/BottomNav";
import { Depliable } from "@/components/Depliable";
import { LogoIA } from "@/components/LogoIA";
import { Header, Page } from "@/components/ui";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "Aide — Cotiz" };

/** Questions fréquentes rangées par thème (pour ne pas tout afficher d'un coup) */
const THEMES: { titre: string; icone: typeof Users; ton: string; mots: RegExp }[] = [
  { titre: "Compte et connexion", icone: KeyRound, ton: "bg-sky-50 text-sky-700", mots: /code|téléphone|compte/i },
  { titre: "Groupes et membres", icone: Users, ton: "bg-emerald-50 text-emerald-700", mots: /tontine|inviter|trésorier|co-gestionnaire|parts|groupe/i },
  { titre: "Paiements et argent", icone: Wallet, ton: "bg-orange-50 text-orange-700", mots: /pa(y|ie)|argent|frais|pénalit|avance|attente|caisse/i },
  { titre: "Application et sécurité", icone: Smartphone, ton: "bg-violet-50 text-violet-700", mots: /.*/ },
];
const rangees = (() => {
  const reste = [...FAQ];
  return THEMES.map((t) => {
    const pris = reste.filter((f) => t.mots.test(f.q));
    pris.forEach((f) => reste.splice(reste.indexOf(f), 1));
    return { ...t, questions: pris };
  }).filter((t) => t.questions.length);
})();

export default function Aide() {
  return (
    <Page>
      <Header title="Aide et service client" />
      <div className="cascade space-y-4 p-4 pb-28">
        {/* En-tête */}
        <section className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0b3d2c] via-[#0f5a3f] to-[#009e60] p-5 text-white shadow-[0_18px_40px_-22px_rgba(11,61,44,0.7)]">
          <div className="motif absolute inset-0 opacity-[0.12]" />
          <div className="balaie pointer-events-none absolute inset-y-0 left-0" />
          <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-emerald-200">Aide Cotiz</p>
          <h1 className="relative mt-1 text-2xl font-extrabold leading-tight">Comment pouvons-nous vous aider ?</h1>
          <p className="relative mt-1.5 text-sm text-emerald-50/90">
            Cotiz IA répond <span className="rounded bg-[#f5c400] px-1.5 py-0.5 font-bold text-[#0b3d2c]">en quelques secondes</span>. Un conseiller prend le relais pour tout ce qui touche à votre argent.
          </p>
          <div className="bande-kente absolute inset-x-0 bottom-0 h-1.5" />
        </section>

        {/* Deux façons d'avoir de l'aide */}
        <section className="grid grid-cols-2 gap-3">
          <a href="#cotiz-ia" className="carte-vivante group relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-violet-700 to-indigo-700 p-4 text-white shadow-[0_14px_30px_-18px_rgba(76,29,149,0.8)]">
            <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />
            <LogoIA taille={46} className="drop-shadow-lg" />
            <p className="mt-3 text-lg font-extrabold leading-none">Cotiz IA</p>
            <p className="mt-1 text-xs leading-snug text-violet-100">Assistant automatique, répond tout de suite</p>
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-bold ring-1 ring-white/20">🤖 24h/24</span>
          </a>
          <a href="#conseiller" className="carte-vivante group relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-[#0b3d2c] p-4 text-white shadow-[0_14px_30px_-18px_rgba(11,61,44,0.8)]">
            <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10" />
            <span className="relative grid h-[46px] w-[46px] place-items-center rounded-[14px] bg-white text-2xl shadow-lg">👩🏾‍💼<span className="en-ligne absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-white" /></span>
            <p className="mt-3 text-lg font-extrabold leading-none">Un conseiller</p>
            <p className="mt-1 text-xs leading-snug text-emerald-100">WhatsApp, SMS ou appel avec l’équipe</p>
            <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[0.65rem] font-bold ring-1 ring-white/20">👤 Humain</span>
          </a>
        </section>

        {/* Cotiz IA */}
        <Depliable id="cotiz-ia" ouvert icone={<LogoIA taille={44} />}
          titre="Discuter avec Cotiz IA"
          badge={<span className="rounded-full bg-violet-100 px-2 py-0.5 text-[0.65rem] font-bold text-violet-800">🤖 Assistant automatique</span>}
          sousTitre={<span>Réponse <span className="surligne font-semibold text-stone-700">immédiate</span>, avec les étapes pas à pas. Un conseiller prend le relais si besoin.</span>}>
          <RequeteClient integre />
        </Depliable>

        {/* Conseiller humain */}
        <ServiceClient />

        {/* Questions fréquentes par thème */}
        <div className="space-y-2.5">
          <h2 className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500"><CircleHelp size={14} /> Questions fréquentes</h2>
          {rangees.map((t) => (
            <Depliable key={t.titre} titre={t.titre} sousTitre={`${t.questions.length} question${t.questions.length > 1 ? "s" : ""}`}
              icone={<span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${t.ton}`}><t.icone size={20} strokeWidth={2} /></span>}>
              <div className="divide-y divide-stone-100 rounded-2xl bg-stone-50/70 ring-1 ring-stone-100">
                {t.questions.map((f) => (
                  <details key={f.q} id={f.id} className="group px-3.5 py-3 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-stone-800">
                      {f.q}
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-base leading-none text-emerald-700 ring-1 ring-stone-200 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.r}</p>
                  </details>
                ))}
              </div>
            </Depliable>
          ))}
        </div>

        <p className="rounded-2xl bg-amber-50 p-3 text-center text-xs text-amber-900 ring-1 ring-amber-200">
          Un souci avec un paiement dans un groupe ? Contactez aussi <span className="surligne font-semibold">votre trésorier</span> avec les boutons « Appeler » ou « Écrire » du groupe.
        </p>
        <p className="text-center text-xs text-stone-400">
          <Link href="/cgu" className="underline">Conditions d’utilisation</Link> · <Link href="/confidentialite" className="underline">Confidentialité</Link> · <Link href="/mentions-legales" className="underline">Mentions légales</Link>
        </p>
      </div>
      <BottomNav />
    </Page>
  );
}
