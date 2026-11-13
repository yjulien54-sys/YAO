import type { Metadata } from "next";
import Link from "next/link";
import { ServiceClient } from "@/components/ServiceClient";
import { RequeteClient } from "@/components/RequeteClient";
import { BottomNav } from "@/components/BottomNav";
import { Header, Page } from "@/components/ui";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = { title: "Aide — Cotiz" };


export default function Aide() {
  return (
    <Page>
      <Header title="Aide et service client" />
      <div className="space-y-5 p-4 pb-28">
        <ServiceClient />
        <RequeteClient />
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
