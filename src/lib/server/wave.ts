/**
 * Intégration Wave Business (API Checkout) — côté serveur uniquement.
 *
 * Variables d'environnement (Vercel > Settings > Environment Variables) :
 *   WAVE_API_KEY                    : clé API du compte Wave Business (portail Wave Business > Développeurs)
 *   SUPABASE_SERVICE_ROLE_KEY       : clé "service_role" de Supabase (secrète !)
 *   NEXT_PUBLIC_PAIEMENT_MODE=wave  : active les vrais paiements Wave dans l'app
 *
 * Webhook à déclarer dans le portail Wave Business :
 *   https://<ton-site>/api/paiements/wave  (événement checkout.session.completed)
 *
 * Sécurité : on ne fait jamais confiance au contenu du webhook, on relit
 * toujours la session directement chez Wave avant de valider un paiement.
 *
 * ⚠️ À vérifier avec la documentation Wave au moment de l'activation.
 */
const API = "https://api.wave.com/v1";

export const waveConfigured = () => Boolean(process.env.WAVE_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

const headers = () => ({ Authorization: `Bearer ${process.env.WAVE_API_KEY}`, "Content-Type": "application/json" });

export async function creerSessionWave(p: { amount: number; clientReference: string; successUrl: string; errorUrl: string }) {
  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      amount: String(Math.round(p.amount)),
      currency: "XOF",
      client_reference: p.clientReference,
      success_url: p.successUrl,
      error_url: p.errorUrl,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.wave_launch_url || !json?.id) throw new Error(`Wave : ${json?.message ?? json?.code ?? `erreur ${res.status}`}`);
  return { id: String(json.id), launchUrl: String(json.wave_launch_url) };
}

export type StatutWave = "ACCEPTED" | "REFUSED" | "WAITING" | "INCONNU";

export async function lireSessionWave(id: string): Promise<StatutWave> {
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(id)}`, { headers: headers() });
  if (!res.ok) return "INCONNU";
  const s = await res.json().catch(() => ({}));
  if (s?.payment_status === "succeeded") return "ACCEPTED";
  if (s?.checkout_status === "expired" || s?.payment_status === "cancelled") return "REFUSED";
  return "WAITING";
}
