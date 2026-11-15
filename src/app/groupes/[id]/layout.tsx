/**
 * Lien d'un groupe (invitation) : titre et affiche propres au groupe quand on le partage sur WhatsApp.
 * Seules des informations générales sont lues (nom, cotisation, nombre de membres, prénom du trésorier).
 */
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { parFrequence } from "@/lib/logic";
import type { InfosGroupe } from "@/lib/server/afficheGroupe";

async function lireGroupe(id: string): Promise<InfosGroupe | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await sb.rpc("groupe_apercu", { g: id });
  return error ? null : ((data as InfosGroupe | null) ?? null);
}

const TYPE = { tontine: "la tontine", association: "l’association", collecte: "la collecte" } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const g = await lireGroupe(id);
  if (!g) return {};
  const titre = `Rejoignez ${TYPE[g.type]} « ${g.nom} » sur Cotiz`;
  const montant = g.type !== "collecte" && g.montant ? `Cotisation : ${g.montant.toLocaleString("fr-FR")} F par ${parFrequence(g.frequence)}. ` : "";
  const desc = `${montant}${g.membres} membre${g.membres > 1 ? "s" : ""}${g.tresorier ? `, trésorier : ${g.tresorier}` : ""}. Tout le monde voit qui a payé. Inscription gratuite.`;
  const image = { url: `/groupes/${id}/affiche?v=${g.theme ?? "a"}-${g.membres}`, width: 1200, height: 630, type: "image/jpeg", alt: titre };
  return {
    title: `${g.nom} · Cotiz`,
    description: desc,
    openGraph: { title: titre, description: desc, siteName: "Cotiz", locale: "fr_FR", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: titre, description: desc, images: [image.url] },
    robots: { index: false },
  };
}

export default function LayoutGroupe({ children }: { children: React.ReactNode }) {
  return children;
}
