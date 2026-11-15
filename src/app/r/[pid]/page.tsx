/**
 * Reçu de paiement PUBLIC : le lien partagé sur WhatsApp s'ouvre pour tout le monde,
 * même sans compte et sans être dans le groupe. Seul ce reçu est visible.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { BadgeCheck } from "lucide-react";
import { fcfa } from "@/lib/format";
import { METHOD_LABEL } from "@/lib/payments";

export const dynamic = "force-dynamic";

type Recu = { id: string; groupe: string; type: "tontine" | "association" | "collecte"; membre: string; montant: number; penalite: number; frais: number; moyen: keyof typeof METHOD_LABEL; tour: number; date: string; reference: string; tresorier: string | null };

async function lire(pid: string): Promise<Recu | null> {
  if (!/^[0-9a-f-]{36}$/i.test(pid)) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await sb.rpc("recu_public", { pid });
  return (data as Recu | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ pid: string }> }): Promise<Metadata> {
  const r = await lire((await params).pid);
  if (!r) return { title: "Reçu Sikaklo" };
  const titre = `Reçu Sikaklo · ${r.membre} · ${fcfa(r.montant + r.penalite)}`;
  return { title: titre, description: `Paiement confirmé · ${r.groupe}`, openGraph: { title: titre, description: `Paiement confirmé · ${r.groupe}`, siteName: "Sikaklo", images: [{ url: "/opengraph-image", width: 1200, height: 630, type: "image/jpeg" }] }, robots: { index: false } };
}

export default async function RecuPublic({ params }: { params: Promise<{ pid: string }> }) {
  const r = await lire((await params).pid);
  const date = r ? new Date(r.date).toLocaleString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" }) : "";
  const lignes: [string, string][] = r ? [
    ["Groupe", r.groupe],
    ["Membre", r.membre],
    ...(r.type !== "collecte" ? ([["Tour", String(r.tour)]] as [string, string][]) : []),
    ["Cotisation", fcfa(r.montant)],
    ...(r.penalite ? ([["Pénalité", fcfa(r.penalite)]] as [string, string][]) : []),
    ...(r.frais ? ([["Frais de paiement", fcfa(r.frais)], ["Total payé", fcfa(r.montant + r.penalite + r.frais)]] as [string, string][]) : []),
    ["Moyen", METHOD_LABEL[r.moyen] ?? String(r.moyen)],
    ["Date", date],
    ["Référence", r.reference],
    ...(r.tresorier ? ([["Trésorier", r.tresorier]] as [string, string][]) : []),
  ] : [];

  return (
    <main className="min-h-dvh bg-[#f7f5f0] px-4 py-8">
      <div className="mx-auto max-w-md space-y-4">
        <Link href="/" className="flex items-center justify-center gap-2 font-extrabold text-[#0b3d2c]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-[11px]" /> Sikaklo
        </Link>
        {!r ? (
          <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-stone-200">
            <p className="text-lg font-bold">Reçu introuvable</p>
            <p className="mt-1 text-sm text-stone-600">Ce reçu n’existe pas, ou le paiement n’a pas encore été confirmé par le trésorier.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
            <div className="h-1.5 bg-gradient-to-r from-[#009e60] via-[#f5c400] to-[#f77f00]" />
            <div className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#f77f00]">Reçu de paiement</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"><BadgeCheck size={14} /> PAYÉ</span>
              </div>
              <p className="mt-5 text-center text-sm text-stone-500">Montant</p>
              <p className="text-center text-4xl font-extrabold tabular-nums text-[#0b3d2c]">{fcfa(r.montant + r.penalite)}</p>
              <div className="my-5 border-t-2 border-dashed border-stone-200" />
              <dl className="space-y-2.5 text-sm">
                {lignes.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4">
                    <dt className="text-stone-500">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 rounded-2xl bg-stone-50 p-3 text-center text-xs text-stone-500">Paiement confirmé par le trésorier du groupe et enregistré dans Sikaklo. Ce reçu ne peut pas être modifié.</p>
            </div>
          </div>
        )}
        <Link href="/" className="block rounded-full bg-emerald-700 py-3.5 text-center text-sm font-bold text-white">Découvrir Sikaklo : tontines et cotisations sans palabres</Link>
      </div>
    </main>
  );
}
