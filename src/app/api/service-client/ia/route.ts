/**
 * Cotiz IA — l'agent IA du service client.
 *
 * Appelée par l'application juste après qu'un client a écrit (nouvelle requête ou réponse
 * dans une conversation que Cotiz IA suit). L'IA lit la conversation et :
 *   - répond aux questions d'utilisation de Cotiz ;
 *   - transmet à un agent humain (avec la raison) dès que la demande touche aux données
 *     ou à l'argent, ou qu'elle n'est pas sûre.
 *
 * Variables Vercel :
 *   SUPABASE_SERVICE_ROLE_KEY  obligatoire (gratuite, déjà utilisée pour les paiements)
 *   ANTHROPIC_API_KEY          facultative et payante : avec elle, Cotiz IA « intelligente » (Claude) ;
 *                              sans elle, mode GRATUIT (réponses automatiques par mots-clés, 0 F).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { FAQ } from "@/lib/faq";
import { repondreGratuit } from "@/lib/server/iaGratuite";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Au-delà de ce nombre de réponses de l'IA dans une même conversation, on passe la main à un humain */
const MAX_REPONSES_IA = 6;

const SYSTEM = `Tu es « Cotiz IA », l'assistant du service client de Cotiz, une application ivoirienne pour gérer les tontines, les cotisations d'associations et les collectes (funérailles, mariages, baptêmes…).

Tu réponds aux clients dans le fil de discussion « Écrire au service client » de l'application.

STYLE
- Français simple et chaleureux, comme on parle en Côte d'Ivoire, tutoiement. Pas de nouchi.
- Court : 2 à 6 phrases. Étapes numérotées quand il faut expliquer une manipulation. Pas de markdown (pas de **, pas de #).
- Commence directement par la réponse (pas de « En tant qu'IA… »). Signe pas, l'application affiche déjà « Cotiz IA ».

CE QUE TU SAIS (connaissances officielles de Cotiz — n'invente rien en dehors) :
${FAQ.map((f) => `- ${f.q} → ${f.r}`).join("\n")}
- Paiement en ligne (Wave, Orange Money, MTN, Moov via l'application) : des frais de service et de l'opérateur s'ajoutent au montant ; la cotisation va entièrement au groupe et le détail des frais figure sur le reçu. Le paiement manuel au trésorier reste gratuit.
- Cotiz ne demande JAMAIS le code secret Mobile Money ni le code secret Cotiz : ne le demande jamais, et préviens le client s'il essaie de te le donner.
- Le service client humain répond aussi par WhatsApp et par téléphone (boutons en haut de la page Aide).

QUAND TRANSMETTRE À UN AGENT HUMAIN (transmettre = true)
Tu ne peux rien faire sur les comptes ni sur l'argent, et tu ne vois pas les données des groupes. Transmets dès que la demande nécessite une vérification ou une action sur des données, notamment :
- un paiement à vérifier, confirmer, annuler ou rembourser ; de l'argent manquant ou un versement non reçu ;
- changer un numéro, un nom ou une date de naissance ; un compte bloqué ; un accès perdu que la FAQ ne règle pas ;
- une arnaque, une fraude, un litige avec un trésorier ou un membre, une menace ;
- une plainte sur le service, ou le client demande à parler à une personne ;
- une suggestion d'amélioration (pour que l'équipe la lise) ;
- tout ce que tu ne sais pas avec certitude grâce aux connaissances ci-dessus.
Dans ce cas, ta réponse dit gentiment que tu transmets à un conseiller qui va lui répondre ici, et si utile, demande en une phrase les informations qui l'aideront (nom du groupe, montant, date, référence de la transaction) — jamais de code secret. N'invente pas de délai précis.

RÉSOUDRE (resoudre = true) seulement quand le client dit clairement que c'est réglé ou remercie sans nouvelle question. Sinon resoudre = false.

Réponds uniquement avec l'objet JSON demandé.`;

const SCHEMA = {
  type: "object",
  properties: {
    reponse: { type: "string", description: "Le message à envoyer au client, en français, sans markdown." },
    transmettre: { type: "boolean", description: "true si un agent humain doit prendre la main." },
    raison: { type: "string", description: "Si transmettre : la raison en quelques mots pour l'équipe (ex : « paiement à vérifier »). Sinon chaîne vide." },
    resoudre: { type: "boolean", description: "true seulement si le client confirme que c'est réglé." },
  },
  required: ["reponse", "transmettre", "raison", "resoudre"],
  additionalProperties: false,
} as const;

type Decision = { reponse: string; transmettre: boolean; raison: string; resoudre: boolean };
type Msg = { auteur: "client" | "agent" | "ia"; texte: string; cree_le: string };

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!token) return NextResponse.json({ ok: false, raison: "non connecté" }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false, raison: "Cotiz IA non configurée" });

  const r = (await req.json().catch(() => null))?.requete;
  if (typeof r !== "string" || !/^[0-9a-f-]{36}$/i.test(r)) return NextResponse.json({ ok: false, raison: "requête invalide" }, { status: 400 });

  // Lecture AVEC les droits du client : il ne peut déclencher l'IA que sur SES requêtes
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: q } = await client.from("requetes_clients").select("id, motif, nom, statut, agent_email, ia_statut, ia_messages").eq("id", r).maybeSingle();
  if (!q) return NextResponse.json({ ok: false, raison: "introuvable" }, { status: 404 });
  if (q.statut === "resolue" || q.ia_statut === "transmis" || (q.agent_email && q.agent_email !== "cotiz-ia")) return NextResponse.json({ ok: false, raison: "suivie par un agent" });

  const service = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: reglage } = await service.from("parametres_app").select("valeur").eq("cle", "cotiz_ia_actif").maybeSingle();
  if (reglage?.valeur === "non") return NextResponse.json({ ok: false, raison: "Cotiz IA éteinte" });

  const { data: fil } = await client.from("requetes_messages").select("auteur, texte, cree_le").eq("requete_id", r).order("cree_le");
  const messages = (fil as Msg[] | null) ?? [];
  if (!messages.length || messages[messages.length - 1].auteur !== "client") return NextResponse.json({ ok: false, raison: "rien de nouveau" });

  // Trop d'échanges : on passe la main sans appeler l'IA
  if ((q.ia_messages ?? 0) >= MAX_REPONSES_IA) {
    await service.rpc("ia_requete_ecrire", { r, texte: "Je transmets ta demande à un conseiller du service client : il va te répondre ici très bientôt.", transmettre: true, raison: "Conversation longue : à reprendre par un agent", resoudre: false });
    return NextResponse.json({ ok: true, transmis: true });
  }

  // Mode gratuit : pas de clé payante → réponses automatiques par mots-clés
  if (!process.env.ANTHROPIC_API_KEY) {
    const d = repondreGratuit(q.motif, messages);
    const { error } = await service.rpc("ia_requete_ecrire", { r, texte: d.reponse, transmettre: d.transmettre, raison: d.transmettre ? d.raison : null, resoudre: d.resoudre });
    if (error) console.error("Cotiz IA (gratuit) : écriture impossible", error.message);
    return NextResponse.json({ ok: !error, transmis: d.transmettre, mode: "gratuit" });
  }

  const conversation = messages
    .map((m) => `${m.auteur === "client" ? "CLIENT" : m.auteur === "ia" ? "COTIZ IA" : "AGENT HUMAIN"} : ${m.texte}`)
    .join("\n\n");

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: `Sujet choisi par le client : ${q.motif}\nPrénom / nom du client : ${q.nom ?? "inconnu"}\n\nConversation (du plus ancien au plus récent) :\n\n${conversation}\n\nÉcris la prochaine réponse de Cotiz IA.` }],
    } as Parameters<typeof anthropic.beta.messages.create>[0]) as Anthropic.Beta.BetaMessage;

    let d: Decision | null = null;
    if (response.stop_reason !== "refusal" && response.stop_reason !== "max_tokens") {
      const texte = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
      try { d = JSON.parse(texte) as Decision; } catch { d = null; }
    }
    // Réponse inexploitable : on transmet à un humain plutôt que de laisser le client sans rien
    if (!d || typeof d.reponse !== "string" || !d.reponse.trim()) {
      d = { reponse: "Je transmets ta demande à un conseiller du service client : il va te répondre ici très bientôt.", transmettre: true, raison: "Cotiz IA n’a pas pu répondre", resoudre: false };
    }
    const { error } = await service.rpc("ia_requete_ecrire", { r, texte: d.reponse, transmettre: !!d.transmettre, raison: d.transmettre ? (d.raison || "À vérifier par un agent") : null, resoudre: !!d.resoudre && !d.transmettre });
    if (error) {
      console.error("Cotiz IA : écriture impossible", error.message);
      return NextResponse.json({ ok: false, raison: "écriture impossible" });
    }
    return NextResponse.json({ ok: true, transmis: !!d.transmettre });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) console.error("Cotiz IA : limite atteinte");
    else if (error instanceof Anthropic.APIError) console.error(`Cotiz IA : erreur ${error.status}`, error.message);
    else console.error("Cotiz IA : erreur", error);
    // Sans réponse de l'IA, la requête reste « nouvelle » : les agents humains la voient
    return NextResponse.json({ ok: false, raison: "IA indisponible" });
  }
}
