/**
 * Assistant de rédaction pour les AGENTS du service client (espace admin).
 * L'agent dit (à l'écrit ou à la voix) ce qu'il veut répondre ; Cotiz IA rédige un message
 * professionnel que l'agent relit, corrige et envoie lui-même. Rien n'est envoyé automatiquement.
 *
 * - Avec ANTHROPIC_API_KEY (payant) : rédaction intelligente par Claude.
 * - Sans clé (gratuit) : mise en forme professionnelle de la consigne + explication du guide si le sujet est reconnu.
 * Réservé aux comptes admin (vérifié par la base).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { GUIDES, texteGuide } from "@/lib/guideCotiz";
import { FAQ } from "@/lib/faq";
import { formel, trouverExplication } from "@/lib/server/iaGratuite";

export const runtime = "nodejs";
export const maxDuration = 60;

type Msg = { auteur: string; texte: string };

/** Mode gratuit : « dis-lui que son paiement est confirmé » → « Votre paiement est confirmé. » */
function mettreEnForme(consigne: string): string {
  let t = consigne.trim().replace(/\s+/g, " ");
  t = t.replace(/^(s.?il te pla[iî]t |stp |svp )/i, "");
  t = t.replace(/^(dis|dites|r[ée]ponds|r[ée]pondez|[ée]cris|[ée]crivez|explique|expliquez|pr[ée]viens|pr[ée]venez|informe|informez)[- ](lui|leur|au client|à la cliente|au membre)( que| qu.| de)?\s*/i, "");
  // 3e personne → vouvoiement (cas courants)
  t = t.replace(/\bson\b/gi, "votre").replace(/\bsa\b/gi, "votre").replace(/\bses\b/gi, "vos")
    .replace(/\bil (doit|peut|va|a|est)\b/gi, (_, v: string) => ({ doit: "vous devez", peut: "vous pouvez", va: "vous allez", a: "vous avez", est: "vous êtes" } as Record<string, string>)[v.toLowerCase()])
    .replace(/\belle (doit|peut|va|a|est)\b/gi, (_, v: string) => ({ doit: "vous devez", peut: "vous pouvez", va: "vous allez", a: "vous avez", est: "vous êtes" } as Record<string, string>)[v.toLowerCase()]);
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (!/[.!?…]$/.test(t)) t += ".";
  return t;
}

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (!token) return NextResponse.json({ ok: false, raison: "non connecté" }, { status: 401 });
  const moi = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { error: pasAdmin } = await moi.rpc("verifier_admin");
  if (pasAdmin) return NextResponse.json({ ok: false, raison: "réservé à l’équipe Cotiz" }, { status: 403 });

  const corps = await req.json().catch(() => null) as { consigne?: string; nom?: string | null; motif?: string; messages?: Msg[] } | null;
  const consigne = String(corps?.consigne ?? "").slice(0, 2000).trim();
  if (!consigne) return NextResponse.json({ ok: false, raison: "Dites à Cotiz IA ce que vous voulez répondre." }, { status: 400 });
  const nom = corps?.nom ?? null;
  const messages = (corps?.messages ?? []).slice(-12).map((m) => ({ auteur: String(m.auteur), texte: String(m.texte).slice(0, 1500) }));
  const premier = !messages.some((m) => m.auteur === "agent" || m.auteur === "ia");

  if (!process.env.ANTHROPIC_API_KEY) {
    const explication = trouverExplication(consigne);
    const texte = formel(`${mettreEnForme(consigne)}${explication ? `\n\n${explication}` : ""}`, nom, premier);
    return NextResponse.json({ ok: true, texte, mode: "gratuit" });
  }

  const system = `Tu aides un agent du service client de Cotiz (application ivoirienne de tontines, associations et collectes) à rédiger sa réponse à un client.
L'agent te donne une consigne (parfois dictée à la voix, donc mal ponctuée). Rédige le message final à envoyer au client.

RÈGLES
- Ton professionnel et courtois, vouvoiement, français correct. Pas d'émojis, pas de markdown.
- ${premier ? "Commence par « Bonjour » et le prénom du client s'il est connu." : "Pas de nouvelle salutation (la conversation est déjà engagée)."}
- Respecte fidèlement la consigne de l'agent : n'ajoute aucune promesse, aucun délai, aucun montant qu'il n'a pas donné.
- Si une manipulation dans l'application est utile, utilise les étapes exactes du guide ci-dessous.
- Termine par « Nous restons à votre disposition. » puis « Cordialement, » puis « Le service client Cotiz », chacun sur sa ligne.
- Réponds uniquement avec le texte du message, rien d'autre.

GUIDE DE L'APPLICATION
${GUIDES.map((g) => texteGuide(g)).join("\n\n")}

QUESTIONS FRÉQUENTES
${FAQ.map((f) => `- ${f.q} → ${f.r}`).join("\n")}`;

  const fil = messages.map((m) => `${m.auteur === "client" ? "CLIENT" : m.auteur === "ia" ? "COTIZ IA" : "AGENT"} : ${m.texte}`).join("\n\n");
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: `Client : ${nom ?? "inconnu"}\nSujet : ${corps?.motif ?? ""}\n\nConversation :\n${fil || "(aucun message)"}\n\nConsigne de l'agent : ${consigne}\n\nRédige le message.` }],
    } as Parameters<typeof anthropic.beta.messages.create>[0]) as Anthropic.Beta.BetaMessage;
    const texte = response.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("").trim();
    if (!texte || response.stop_reason === "refusal") throw new Error("vide");
    return NextResponse.json({ ok: true, texte, mode: "claude" });
  } catch (e) {
    console.error("Brouillon Cotiz IA", e instanceof Anthropic.APIError ? e.status : "", (e as Error).message);
    // Repli gratuit pour ne jamais bloquer l'agent
    const explication = trouverExplication(consigne);
    return NextResponse.json({ ok: true, texte: formel(`${mettreEnForme(consigne)}${explication ? `\n\n${explication}` : ""}`, nom, premier), mode: "gratuit" });
  }
}
