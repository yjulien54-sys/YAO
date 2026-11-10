import Link from "next/link";
import { ArrowLeft, ChevronDown, FileText, Landmark, ShieldCheck } from "lucide-react";
import { SUPPORT_AFFICHE } from "@/lib/support";

export type Article = { id: string; titre: string; contenu: React.ReactNode };

const DOCUMENTS = [
  { href: "/cgu", label: "Conditions générales d’utilisation", icon: FileText },
  { href: "/confidentialite", label: "Politique de confidentialité", icon: ShieldCheck },
  { href: "/mentions-legales", label: "Mentions légales", icon: Landmark },
];

/** Champ restant à compléter (ex : numéro RCCM), bien visible tant qu'il n'est pas rempli */
export function ACompleter({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">[À compléter : {children}]</span>;
}

/** Mise en page commune des documents juridiques (style institutionnel) */
export function DocumentLegal({ titre, chapeau, maj, version, articles, actuel }: { titre: string; chapeau: string; maj: string; version: string; articles: Article[]; actuel: string }) {
  return (
    <div className="min-h-dvh bg-[#f7f5f0] text-stone-800">
      <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-extrabold tracking-tight text-stone-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-[9px]" />
            Cotiz
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            <ArrowLeft size={16} strokeWidth={2} /> Retour
          </Link>
        </div>
      </header>

      <section className="degrade-vert relative overflow-hidden text-white">
        <div className="motif absolute inset-0 opacity-60" />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-8 lg:pb-14 lg:pt-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/90">Informations juridiques</p>
          <h1 className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight lg:text-[2.5rem]">{titre}</h1>
          <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-emerald-50/90">{chapeau}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">Version {version}</span>
            <span className="rounded-full bg-white/15 px-3 py-1 ring-1 ring-white/25">En vigueur au {maj}</span>
          </div>
        </div>
        <div className="bande-kente absolute inset-x-0 bottom-0" />
      </section>

      <div className="mx-auto max-w-6xl px-4 py-6 lg:grid lg:grid-cols-[260px_1fr] lg:gap-10 lg:py-10">
        <aside className="mb-6 lg:mb-0">
          {/* Téléphone : sommaire repliable */}
          <details className="carte group p-4 lg:hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-bold text-stone-900">
              Sommaire · {articles.length} articles
              <ChevronDown size={18} strokeWidth={2} className="text-stone-400 transition group-open:rotate-180" />
            </summary>
            <Sommaire articles={articles} />
          </details>
          {/* Ordinateur : sommaire fixe */}
          <nav className="carte hidden p-4 lg:sticky lg:top-20 lg:block">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Sommaire</p>
            <Sommaire articles={articles} />
          </nav>
        </aside>

        <main className="min-w-0 space-y-4">
          {articles.map((a, i) => (
            <article key={a.id} id={a.id} className="carte scroll-mt-20 p-5 lg:p-7">
              <h2 className="flex items-baseline gap-3 text-lg font-extrabold tracking-tight text-stone-900">
                <span className="text-sm font-bold tabular-nums text-emerald-700">Article {i + 1}</span>
                {a.titre}
              </h2>
              <div className="juridique mt-3 space-y-3 text-[0.95rem] leading-relaxed text-stone-700">{a.contenu}</div>
            </article>
          ))}

          <section className="carte p-5 lg:p-7">
            <p className="text-sm font-bold text-stone-900">Autres documents</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {DOCUMENTS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-sm font-semibold transition ${href === actuel ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-stone-200 text-stone-700 hover:border-emerald-200 hover:bg-emerald-50/50"}`}
                >
                  <Icon size={18} strokeWidth={1.8} className="shrink-0 text-emerald-700" />
                  {label}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-xs text-stone-500">Une question sur ce document ? Service client : <b className="text-stone-700">{SUPPORT_AFFICHE}</b> (appel ou WhatsApp).</p>
          </section>
        </main>
      </div>
    </div>
  );
}

function Sommaire({ articles }: { articles: Article[] }) {
  return (
    <ol className="mt-2 space-y-0.5 text-sm lg:mt-0">
      {articles.map((a, i) => (
        <li key={a.id}>
          <a href={`#${a.id}`} className="flex gap-2 rounded-lg px-2 py-1.5 text-stone-700 hover:bg-emerald-50 hover:text-emerald-800">
            <span className="w-5 shrink-0 font-bold tabular-nums text-emerald-700">{i + 1}.</span>
            <span>{a.titre}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}
