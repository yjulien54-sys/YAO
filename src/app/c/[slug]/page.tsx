/**
 * Page publique d'une cagnotte Cotiz (mariage, funérailles, baptême, santé…).
 * Lisible sans compte, pensée pour être partagée sur WhatsApp. Mise en page sobre et
 * éditoriale : grande photo, histoire, participants, et une carte de participation
 * (fixe sur ordinateur, barre en bas sur téléphone).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { CalendarClock, HandCoins, Lock, ReceiptText, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Partage } from "./Partage";

export const dynamic = "force-dynamic";

type Cagnotte = {
  id: string; nom: string; description: string | null; cause: string | null; message: string | null; photo: string | null;
  objectif: number | null; montant_suggere: number | null; collecte: number; donateurs_nb: number; montants: boolean; fin: string | null;
  tresorier: string | null; cle: string | null; cree_le: string; donateurs: { nom: string; montant: number | null; le: string }[];
};

const fcfa = (n: number) => `${Math.round(n).toLocaleString("fr-FR").replace(/[  ]/g, " ")} F CFA`;
const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://tontine-et-cotise.vercel.app";

async function lire(slug: string, compter = true): Promise<Cagnotte | null> {
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("cagnotte_publique", { s: slug, compter });
  return error ? null : ((data as Cagnotte | null) ?? null);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = await lire(slug, false);
  if (!c) return { title: "Cagnotte introuvable · Cotiz" };
  const pct = c.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const titre = `${c.nom} · Cagnotte Cotiz`;
  const desc = `${fcfa(c.collecte)} collectés${c.objectif ? ` sur ${fcfa(c.objectif)} (${pct} %)` : ""}, ${c.donateurs_nb} participant${c.donateurs_nb > 1 ? "s" : ""}. ${c.message ?? c.description ?? "Participez par Wave, Orange Money, MTN ou Moov."}`.slice(0, 200);
  const image = c.photo ?? `${site}/icons/icon-512.png`;
  return {
    title: titre, description: desc,
    openGraph: { title: titre, description: desc, images: [{ url: image, width: 1200, height: 630 }], type: "website", url: `${site}/c/${slug}`, siteName: "Cotiz" },
    twitter: { card: "summary_large_image", title: titre, description: desc, images: [image] },
  };
}

/** Bandeau du haut : la marque Cotiz, toujours visible */
function Marque() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[#fbfaf7]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Cotiz, accueil">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-[10px]" />
          <span className="text-[1.35rem] font-extrabold tracking-tight text-[#0b3d2c]">Cotiz</span>
        </Link>
        <Link href="/" className="rounded-full border border-[#0b3d2c]/15 px-4 py-2 text-sm font-semibold text-[#0b3d2c] transition hover:bg-[#0b3d2c] hover:text-white">
          Créer une cagnotte
        </Link>
      </div>
    </header>
  );
}

export default async function PageCagnotte({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = await lire(slug);
  if (!c) {
    return (
      <main className="min-h-dvh bg-[#fbfaf7] text-stone-900">
        <Marque />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="text-2xl font-extrabold tracking-tight">Cette cagnotte n’est plus disponible</p>
          <p className="mt-2 text-stone-600">Le lien est incorrect, ou l’organisateur a retiré la page.</p>
          <Link href="/" className="mt-6 inline-block rounded-full bg-[#0b3d2c] px-6 py-3 text-sm font-semibold text-white">Découvrir Cotiz</Link>
        </div>
      </main>
    );
  }

  const pct = c.objectif ? Math.min(100, Math.round((c.collecte / c.objectif) * 100)) : null;
  const joursRestants = c.fin ? Math.ceil((new Date(c.fin + "T23:59:59").getTime() - Date.now()) / 86400000) : null;
  const terminee = joursRestants != null && joursRestants <= 0;
  const participer = `/groupes/${c.id}/payer${c.cle ? `?i=${c.cle}` : ""}`;
  const lien = `${site}/c/${slug}`;
  const histoire = c.message ?? c.description;
  const texteWhatsApp = `${c.nom}\n\n${histoire ?? "Je participe à cette cagnotte. Rejoignez-nous."}\n\n${fcfa(c.collecte)} déjà collectés${c.objectif ? ` sur ${fcfa(c.objectif)}` : ""}.\nParticiper (Wave, Orange Money, MTN, Moov) :\n${lien}`;
  const dateCreation = new Date(c.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const initiale = (n: string) => n.trim().slice(0, 1).toUpperCase();

  const Carte = ({ className = "" }: { className?: string }) => (
    <div className={`rounded-[22px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-12px_rgba(11,61,44,0.18)] ${className}`}>
      <p className="text-[2rem] font-extrabold leading-none tracking-tight text-[#0b3d2c] tabular-nums">{fcfa(c.collecte)}</p>
      <p className="mt-1.5 text-[0.95rem] text-stone-500">{c.objectif ? <>collectés sur un objectif de <span className="font-semibold text-stone-800">{fcfa(c.objectif)}</span></> : "collectés à ce jour"}</p>
      {pct != null && (
        <div className="mt-5">
          <div className="h-2 overflow-hidden rounded-full bg-[#eef1ee]">
            <div className="etire h-full rounded-full bg-[#009e60]" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
          <p className="mt-2 text-sm font-semibold text-[#009e60]">{pct} % de l’objectif</p>
        </div>
      )}
      <dl className="mt-5 grid grid-cols-2 divide-x divide-black/[0.06] rounded-2xl bg-[#f6f7f5] py-3 text-center">
        <div><dt className="text-xs text-stone-500">Participants</dt><dd className="text-lg font-bold tabular-nums text-stone-900">{c.donateurs_nb}</dd></div>
        <div><dt className="text-xs text-stone-500">{terminee ? "Statut" : joursRestants != null ? "Jours restants" : "Ouverte depuis"}</dt><dd className="text-lg font-bold tabular-nums text-stone-900">{terminee ? "Terminée" : joursRestants != null ? joursRestants : new Date(c.cree_le).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</dd></div>
      </dl>
      {c.montant_suggere ? <p className="mt-4 text-center text-sm text-stone-600">Participation suggérée : <span className="font-semibold text-stone-900">{fcfa(c.montant_suggere)}</span></p> : null}
      <Link href={participer} aria-disabled={terminee} className={`mt-5 block rounded-full py-4 text-center text-base font-bold text-white transition ${terminee ? "pointer-events-none bg-stone-300" : "bg-[#f77f00] hover:bg-[#e07200] shadow-[0_8px_20px_-8px_rgba(247,127,0,0.6)]"}`}>
        {terminee ? "Cagnotte terminée" : "Participer"}
      </Link>
      <div className="mt-3"><Partage texte={texteWhatsApp} lien={lien} large /></div>
      <ul className="mt-6 space-y-3 border-t border-black/[0.06] pt-5 text-sm text-stone-600">
        <li className="flex gap-3"><Smartphone size={18} className="mt-0.5 shrink-0 text-[#009e60]" /> Wave, Orange Money, MTN MoMo ou Moov Money</li>
        <li className="flex gap-3"><HandCoins size={18} className="mt-0.5 shrink-0 text-[#009e60]" /> L’argent est versé à la cagnotte gérée par {c.tresorier ?? "l’organisateur"}</li>
        <li className="flex gap-3"><ReceiptText size={18} className="mt-0.5 shrink-0 text-[#009e60]" /> Chaque participation est enregistrée, avec un reçu</li>
      </ul>
    </div>
  );

  return (
    <main className="min-h-dvh bg-[#fbfaf7] pb-28 text-stone-900 lg:pb-16">
      <Marque />

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
        {/* Titre */}
        <div className="page-entre max-w-3xl">
          {c.cause && <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#f77f00]">{c.cause}</p>}
          <h1 className="mt-2 text-[2rem] font-extrabold leading-[1.1] tracking-tight text-[#0b2a20] sm:text-[2.6rem]">{c.nom}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-600">
            {c.tresorier && (
              <span className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0b3d2c] text-xs font-bold text-white">{initiale(c.tresorier)}</span>
                Organisée par <span className="font-semibold text-stone-900">{c.tresorier}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5"><CalendarClock size={16} className="text-stone-400" /> Créée le {dateCreation}</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={16} className="text-[#009e60]" /> Paiements suivis par Cotiz</span>
          </div>
        </div>

        <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12">
          {/* Colonne principale */}
          <div className="min-w-0">
            <figure className="page-entre overflow-hidden rounded-[22px] bg-[#eef1ee]" style={{ animationDelay: "60ms" }}>
              {c.photo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={c.photo} alt={c.nom} className="aspect-[16/10] w-full object-cover" />
                : (
                  <div className="relative grid aspect-[16/10] w-full place-items-center bg-[#0b3d2c]">
                    <div className="motif absolute inset-0 opacity-25" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/icons/logo.svg" alt="Cotiz" width={88} height={88} className="relative h-20 w-20 rounded-[22px] shadow-2xl" />
                  </div>
                )}
            </figure>

            {/* Carte de participation : sur téléphone, juste sous la photo */}
            <div className="mt-6 lg:hidden"><Carte /></div>

            {histoire && (
              <section className="mt-10">
                <h2 className="text-lg font-bold tracking-tight text-[#0b2a20]">À propos de cette cagnotte</h2>
                <p className="mt-3 whitespace-pre-line text-[1.05rem] leading-[1.75] text-stone-700">{histoire}</p>
              </section>
            )}

            <section className="mt-10">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold tracking-tight text-[#0b2a20]">Participants</h2>
                <span className="flex items-center gap-1.5 text-sm text-stone-500"><Users size={15} /> {c.donateurs_nb}</span>
              </div>
              {c.donateurs.length === 0 ? (
                <p className="mt-3 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-stone-500">Aucune participation pour l’instant. Soyez la première personne à participer.</p>
              ) : (
                <ul className="mt-3 divide-y divide-black/[0.06] rounded-[22px] border border-black/[0.06] bg-white">
                  {c.donateurs.map((d, k) => (
                    <li key={k} className="flex items-center gap-4 px-5 py-4">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e8f3ee] text-sm font-bold text-[#0b3d2c]">{initiale(d.nom)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-stone-900">{d.nom}</p>
                        <p className="text-xs text-stone-500">{new Date(d.le).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>
                      </div>
                      {d.montant != null && <p className="font-semibold tabular-nums text-stone-900">{fcfa(d.montant)}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mt-10 rounded-[22px] bg-[#f1f4f2] p-6">
              <h2 className="text-lg font-bold tracking-tight text-[#0b2a20]">Comment participer</h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {[
                  ["Touchez « Participer »", "Indiquez votre nom et votre numéro : votre espace Cotiz est créé en une minute."],
                  ["Choisissez le montant", "Payez avec Wave, Orange Money, MTN MoMo ou Moov Money depuis votre téléphone."],
                  ["Recevez votre reçu", "Votre participation apparaît dans la cagnotte, visible par l’organisateur."],
                ].map(([t, d], k) => (
                  <li key={t}>
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-[#0b3d2c] text-sm font-bold text-white">{k + 1}</span>
                    <p className="mt-2 font-semibold text-stone-900">{t}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-600">{d}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* Colonne de droite (ordinateur) : carte fixe */}
          <aside className="hidden lg:block">
            <div className="sticky top-24"><Carte /></div>
          </aside>
        </div>
      </div>

      <footer className="mx-auto mt-16 max-w-6xl border-t border-black/[0.06] px-4 pt-8 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
            <div>
              <p className="font-extrabold text-[#0b3d2c]">Cotiz</p>
              <p className="text-sm text-stone-500">Tontines, associations et cagnottes, en toute transparence.</p>
            </div>
          </div>
          <Link href="/" className="rounded-full bg-[#0b3d2c] px-5 py-3 text-center text-sm font-semibold text-white">Organiser ma cagnotte gratuitement</Link>
        </div>
        <p className="mt-6 flex items-center gap-1.5 pb-6 text-xs text-stone-500"><Lock size={12} /> Cotiz ne vous demandera jamais votre code secret Mobile Money.</p>
      </footer>

      {/* Barre d'action (téléphone) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-extrabold tabular-nums text-[#0b3d2c]">{fcfa(c.collecte)}</p>
            <p className="text-xs text-stone-500">{pct != null ? `${pct} % de l’objectif` : `${c.donateurs_nb} participant${c.donateurs_nb > 1 ? "s" : ""}`}</p>
          </div>
          <Partage texte={texteWhatsApp} lien={lien} />
          <Link href={participer} aria-disabled={terminee} className={`rounded-full px-6 py-3.5 text-[0.95rem] font-bold text-white ${terminee ? "pointer-events-none bg-stone-300" : "bg-[#f77f00]"}`}>{terminee ? "Terminée" : "Participer"}</Link>
        </div>
      </div>
    </main>
  );
}
