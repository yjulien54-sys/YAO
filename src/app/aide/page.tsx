import type { Metadata } from "next";
import Link from "next/link";
import { ServiceClient } from "@/components/ServiceClient";
import { RequeteClient } from "@/components/RequeteClient";
import { BottomNav } from "@/components/BottomNav";
import { Header, Page } from "@/components/ui";
import { FAQ } from "@/lib/faq";
import { Headset, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Aide — Cotiz" };


export default function Aide() {
  return (
    <Page>
      <Header title="Aide et service client" />
      <div className="space-y-5 p-4 pb-28">
        {/* Deux façons d'avoir de l'aide : bien distinctes */}
        <section className="grid grid-cols-2 gap-2.5">
          <a href="#mes-requetes" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-white shadow-sm">
            <Sparkles size={22} />
            <p className="mt-2 font-extrabold leading-tight">Cotiz IA</p>
            <p className="text-xs text-violet-100">Assistant automatique · répond tout de suite</p>
            <span className="mt-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-bold">🤖 Robot · 24h/24</span>
          </a>
          <a href="#conseiller" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 text-white shadow-sm">
            <Headset size={22} />
            <p className="mt-2 font-extrabold leading-tight">Un conseiller</p>
            <p className="text-xs text-emerald-100">WhatsApp, SMS ou appel avec l’équipe Cotiz</p>
            <span className="mt-2 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-bold">👤 Une vraie personne</span>
          </a>
        </section>
        <RequeteClient />
        <ServiceClient />
        <section>
          <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-stone-500">Questions fréquentes</h2>
          <div className="carte divide-y divide-stone-100 overflow-hidden">
            {FAQ.map((f) => (
              <details key={f.q} id={f.id} className="group px-4 py-3 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold">
                  {f.q}
                  <span className="text-lg leading-none text-stone-400 transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">{f.r}</p>
              </details>
            ))}
          </div>
        </section>
        <p className="text-center text-xs text-stone-500">
          Un souci avec un paiement dans un groupe ? Tu peux aussi contacter ton trésorier avec les boutons « Appeler » ou « Écrire » dans le groupe.
        </p>
        <p className="text-center text-xs text-stone-400">
          <Link href="/cgu" className="underline">Conditions d’utilisation</Link> · <Link href="/confidentialite" className="underline">Confidentialité</Link> · <Link href="/mentions-legales" className="underline">Mentions légales</Link>
        </p>
      </div>
      <BottomNav />
    </Page>
  );
}
