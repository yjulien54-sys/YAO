import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { EVENEMENT_LABEL, messageModele, type ContexteMessage } from "@/lib/messages";

export const runtime = "nodejs";

const SYSTEM = `Tu écris des messages WhatsApp pour Cotiz, une application ivoirienne de tontines, cotisations d'associations et collectes (funérailles, mariages, baptêmes…).

Règles :
- Français simple et chaleureux, comme on parle en Côte d'Ivoire, tutoiement pour un message individuel, « vous / chers tous » pour un message de groupe. Pas de nouchi.
- Court : 2 à 5 phrases, 600 caractères maximum. Quelques emojis adaptés, sans excès. Mets le montant en gras WhatsApp (*montant*).
- Adapte le ton à l'événement : décès/funérailles = respect, compassion, condoléances, JAMAIS de pénalité, de reproche ni d'urgence commerciale ; mariage, naissance, anniversaire = joie et fête ; maladie = soutien ; tontine/association = rappel amical, plus ferme mais toujours poli en cas de retard (mentionner la pénalité si elle existe).
- Adapte au moment : bien avant l'échéance = simple information ; bientôt = rappel ; jour J = dernier jour ; en retard = régulariser vite pour ne pas bloquer le bénéficiaire.
- Utilise uniquement les informations fournies, n'invente ni nom, ni montant, ni date, ni lieu.
- Termine par le lien de paiement EXACTEMENT tel que fourni, seul sur sa ligne, précédé d'une courte phrase indiquant qu'on peut payer par Wave, Orange Money, MTN ou Moov.
- Réponds uniquement avec le texte du message, sans guillemets ni commentaire.`;

function clean(c: Partial<ContexteMessage>): ContexteMessage | null {
  const s = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : undefined);
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  if (!c || typeof c.lien !== "string" || !c.evenement || !c.moment || !c.type) return null;
  return {
    type: c.type === "groupe" ? "groupe" : "relance",
    evenement: c.evenement in EVENEMENT_LABEL ? c.evenement : "collecte",
    moment: ["avance", "bientot", "jour", "retard"].includes(c.moment) ? c.moment : "bientot",
    joursRestants: n(c.joursRestants) ?? 0,
    groupe: s(c.groupe) ?? "",
    description: s(c.description, 500),
    typeGroupe: c.typeGroupe ?? "tontine",
    destinataire: s(c.destinataire, 60),
    montant: n(c.montant),
    penalite: n(c.penalite),
    tour: n(c.tour),
    echeance: s(c.echeance, 60) ?? "",
    objectif: n(c.objectif),
    collecte: n(c.collecte),
    restants: Array.isArray(c.restants) ? c.restants.slice(0, 50).map((x) => String(x).slice(0, 40)) : undefined,
    lien: c.lien.slice(0, 300),
  };
}

export async function POST(req: Request) {
  // Réservé aux utilisateurs connectés
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: auth } = token ? await supabase.auth.getUser(token) : { data: { user: null } };
  if (!auth.user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const c = clean((await req.json().catch(() => null))?.contexte);
  if (!c) return NextResponse.json({ error: "contexte invalide" }, { status: 400 });

  const modele = messageModele(c);
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ texte: modele, source: "modele" });

  try {
    const client = new Anthropic();
    const details = {
      type_de_message: c.type === "groupe" ? "message pour tout le groupe WhatsApp" : `message individuel à ${c.destinataire}`,
      evenement: EVENEMENT_LABEL[c.evenement],
      moment: { avance: "bien avant l'échéance", bientot: "échéance proche", jour: "jour de l'échéance", retard: "échéance dépassée" }[c.moment],
      jours_restants: c.joursRestants,
      nom_du_groupe: c.groupe,
      description_du_groupe: c.description,
      montant_du_en_FCFA: c.montant,
      dont_penalite_FCFA: c.penalite || undefined,
      tour: c.tour,
      echeance: c.echeance,
      objectif_collecte_FCFA: c.objectif,
      deja_collecte_FCFA: c.objectif ? c.collecte : undefined,
      membres_qui_n_ont_pas_encore_paye: c.restants,
      lien_de_paiement: c.lien,
    };
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content: `Écris le message à partir de ces informations :\n${JSON.stringify(details, null, 2)}` }],
    });
    if (response.stop_reason === "refusal") return NextResponse.json({ texte: modele, source: "modele" });
    const texte = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    if (!texte) return NextResponse.json({ texte: modele, source: "modele" });
    // Sécurité : le lien de paiement doit toujours être présent
    const final = texte.includes(c.lien) ? texte : `${texte}\n\n${c.lien}`;
    return NextResponse.json({ texte: final, source: "ia" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.error("IA : limite atteinte");
    else if (error instanceof Anthropic.APIError) console.error(`IA : erreur ${error.status}`, error.message);
    else console.error("IA : erreur", error);
    return NextResponse.json({ texte: modele, source: "modele" });
  }
}
