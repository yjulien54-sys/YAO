/**
 * Page publique d'une cagnotte Cotiz (mariage, funérailles, baptême, santé…).
 * Lisible sans compte, pensée pour être partagée sur WhatsApp : photo, jauge de
 * l'objectif, donateurs, bouton « Participer ». Le trésorier la publie depuis
 * les paramètres de sa collecte.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Partage } from "./Partage";

export const dynamic = "force-dynamic";

type Cagnotte = {
  id: string; nom: string; description: string | null; cause: string | null; message: string | null; photo: string | null;
  objectif: number | null; montant_suggere: number | null; collecte: number; donateurs_nb: number; montants: boolean; fin: string | null;
  tresorier: string | null; cle: string | null; cree_le: string; donateurs: { nom: string; montant: number | null; le: string }[];
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/ /g, " ")} F`;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tontine-et-cotise.vercel.app";

async function lire(slug: string): Promise<Cagnotte | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("cagnotte_publique", { s: slug });
  return error ? null : ((data as Cagnotte | null) ?? null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await lire(slug);
  if (!c) return { title: "Cagnotte introuvable — Cotiz" };
  const pct = c.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const titre = `${c.nom} — Cagnotte Cotiz`;
  const desc = `${fcfa(c.collecte)} collectés${c.objectif ? ` sur ${fcfa(c.objectif)} (${pct} %)` : ""} · ${c.donateurs_nb} participant${c.donateurs_nb > 1 ? "s" : ""}. ${c.message ?? c.description ?? "Participe toi aussi."}`.slice(0, 200);
  const image = c.photo ?? `${site}/icons/icon-512.png`;
  return {
    title: titre, description: desc,
    openGraph: { title: titre, description: desc, images: [{ url: image }], type: "website", url: `${site}/c/${slug}`, siteName: "Cotiz" },
    twitter: { card: "summary_large_image", title: titre, description: desc, images: [image] },
  };
}

export default async function PageCagnotte({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await lire(slug);
  if (!c) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f7f5f0] p-6 text-center">
        <div className="max-w-sm space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="Cotiz" width={64} height={64} className="mx-auto h-16 w-16 rounded-2xl" />
          <p className="text-xl font-extrabold">Cagnotte introuvable</p>
          <p className="text-sm text-stone-600">Ce lien n’existe pas ou la cagnotte n’est plus publique.</p>
          <Link href="/" className="inline-block rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white">Découvrir Cotiz</Link>
        </div>
      </main>
    );
  }
  const pct = c.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const joursRestants = c.fin ? Math.ceil((new Date(c.fin + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
  const participer = `/groupes/${c.id}/payer${c.cle ? `?i=${c.cle}` : ""}`;
  const lien = `${site}/c/${slug}`;
  const texteWhatsApp = `🙏 ${c.nom}\n\n${c.message ?? c.description ?? "Je participe à cette cagnotte, rejoins-nous !"}\n\n${fcfa(c.collecte)} déjà collectés${c.objectif ? ` sur ${fcfa(c.objectif)}` : ""} par ${c.donateurs_nb} personne${c.donateurs_nb > 1 ? "s" : ""}.\n\nParticipe ici (Wave, Orange Money, MTN, Moov) 👇\n${lien}`;
  const R = 54, C = 2 * Math.PI * R;
  return (
    <main className="min-h-dvh bg-[#f4f2ec] bg-[radial-gradient(ellipse_at_top,#e3f4ec_0%,transparent_60%)] pb-28">
      {/* Photo de couverture */}
      <div className="relative h-72 overflow-hidden sm:h-96">
        {c.photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          : <div className="degrade-vert absolute inset-0"><div className="motif absolute inset-0 opacity-30" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/90 py-1 pl-1 pr-3 shadow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
          <span className="text-xs font-extrabold text-emerald-800">Cagnotte Cotiz</span>
        </div>
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-2xl p-5 text-white">
          {c.cause && <span className="mb-2 inline-block rounded-full bg-orange-500 px-3 py-1 text-xs font-extrabold uppercase tracking-wide shadow">{c.cause}</span>}
          <h1 className="text-3xl font-extrabold leading-tight drop-shadow sm:text-4xl">{c.nom}</h1>
          {c.tresorier && <p className="mt-1 text-sm text-white/90">Organisée par <b>{c.tresorier}</b></p>}
        </div>
        <div className="bande-kente absolute inset-x-0 bottom-0" />
      </div>

      <div className="mx-auto -mt-2 max-w-2xl space-y-4 px-4 pt-5">
        {/* Jauge */}
        <section className="page-entre relative overflow-hidden rounded-3xl bg-white p-5 shadow-lg ring-1 ring-stone-200/70">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
            <svg viewBox="0 0 128 128" className="h-32 w-32 shrink-0 -rotate-90">
              <defs><linearGradient id="jauge" x1="0" x2="1"><stop offset="0" stopColor="#f77f00" /><stop offset="1" stopColor="#009e60" /></linearGradient></defs>
              <circle cx="64" cy="64" r={R} fill="none" stroke="#efeae4" strokeWidth="12" />
              <circle cx="64" cy="64" r={R} fill="none" stroke="url(#jauge)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${C}`} strokeDashoffset={`${C * (1 - (pct ?? 100) / 100)}`} className="jauge-anime" style={{ ["--c" as string]: `${C}` }} />
              <text x="64" y="70" textAnchor="middle" transform="rotate(90 64 64)" fontSize="24" fontWeight="800" fill="#1c1917">{pct != null ? `${pct}%` : "❤"}</text>
            </svg>
            <div className="min-w-0">
              <p className="whitespace-nowrap text-4xl font-extrabold tabular-nums text-stone-900">{fcfa(c.collecte)}</p>
              <p className="text-sm text-stone-600">{c.objectif ? <>collectés sur un objectif de <b>{fcfa(c.objectif)}</b></> : "collectés"}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5 text-xs sm:justify-start">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-bold text-emerald-800 ring-1 ring-emerald-200">{c.donateurs_nb} participant{c.donateurs_nb > 1 ? "s" : ""}</span>
                {joursRestants != null && <span className={`rounded-full px-2.5 py-1 font-bold ring-1 ${joursRestants > 0 ? "bg-orange-50 text-orange-800 ring-orange-200" : "bg-stone-100 text-stone-600 ring-stone-200"}`}>{joursRestants > 0 ? `encore ${joursRestants} jour${joursRestants > 1 ? "s" : ""}` : "terminée"}</span>}
                {c.montant_suggere && <span className="rounded-full bg-stone-100 px-2.5 py-1 font-bold text-stone-700 ring-1 ring-stone-200">participation : {fcfa(c.montant_suggere)}</span>}
              </div>
            </div>
          </div>
          {c.objectif ? <div className="mt-4 h-3 overflow-hidden rounded-full bg-stone-100"><div className="etire h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-600" style={{ width: `${pct}%` }} /></div> : null}
        </section>

        {(c.message || c.description) && (
          <section className="page-entre rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70" style={{ animationDelay: "80ms" }}>
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-stone-700">{c.message ?? c.description}</p>
          </section>
        )}

        {/* Donateurs */}
        <section className="page-entre rounded-3xl bg-white p-5 shadow-sm ring-1 ring-stone-200/70" style={{ animationDelay: "160ms" }}>
          <p className="mb-3 font-extrabold">💚 Ils ont participé</p>
          {c.donateurs.length === 0 ? <p className="text-sm text-stone-500">Sois la première personne à participer !</p> : (
            <ul className="divide-y divide-stone-100">
              {c.donateurs.map((d, k) => (
                <li key={k} className="flex items-center gap-3 py-2.5 text-sm">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-extrabold text-white" style={{ background: ["#009e60", "#f77f00", "#2c7fb8", "#7c3aed", "#db2777"][k % 5] }}>{d.nom.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1"><b className="font-semibold">{d.nom}</b><span className="block text-xs text-stone-500">{new Date(d.le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span></span>
                  {d.montant != null && <b className="tabular-nums text-emerald-800">{fcfa(d.montant)}</b>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 text-white shadow-lg">
          <p className="font-extrabold">Toi aussi, organise ta cagnotte gratuitement</p>
          <p className="mt-1 text-sm text-emerald-100">Tontines, associations, mariages, funérailles : Cotiz suit chaque paiement Wave, Orange Money, MTN et Moov, en toute transparence.</p>
          <Link href="/" className="mt-3 inline-block rounded-2xl bg-white px-4 py-2.5 text-sm font-extrabold text-emerald-800">Créer ma cagnotte avec Cotiz</Link>
        </section>
        <p className="text-center text-xs text-stone-500">L’argent est envoyé au trésorier de la cagnotte. Cotiz suit les paiements et ne demande jamais ton code secret.</p>
      </div>

      {/* Barre d'action fixe */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Link href={participer} className="flex-1 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-center text-base font-extrabold text-white shadow-lg shadow-orange-900/20">Participer à la cagnotte</Link>
          <Partage texte={texteWhatsApp} lien={lien} />
        </div>
      </div>
    </main>
  );
}
