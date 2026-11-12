/**
 * Intégration GeniusPay — côté serveur uniquement.
 *
 * Variables d'environnement à mettre dans Vercel (Settings > Environment Variables),
 * JAMAIS dans le code ni dans une conversation :
 *   GENIUSPAY_PUBLIC_KEY      clé publique  (Dashboard GeniusPay > Paramètres > Credentials)
 *   GENIUSPAY_SECRET_KEY      clé secrète   (idem)
 *   GENIUSPAY_WEBHOOK_SECRET  secret du webhook (idem, si GeniusPay en fournit un)
 *   NEXT_PUBLIC_PAIEMENT_MODE=geniuspay   active les vrais paiements dans l'app
 *
 * Adresse de l’API confirmée dans l’« API Tester » GeniusPay : https://pay.genius.ci/api/v1/merchant.
 * Points d’entrée repris du kit officiel GeniusPay pour Laravel (base /api/v1/merchant,
 * en-têtes X-API-Key / X-API-Secret, POST /payments, GET /payments/{reference},
 * webhook signé X-GeniusPay-Signature = HMAC-SHA256 du corps brut).
 * ⚠️ À confirmer avec la documentation du Dashboard au moment de l'activation.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PayMethod } from "../types";

const API = (process.env.GENIUSPAY_API_URL || "https://pay.genius.ci/api/v1/merchant").replace(/\/$/, "");

export const geniuspayConfigure = () =>
  Boolean(process.env.GENIUSPAY_PUBLIC_KEY && process.env.GENIUSPAY_SECRET_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY);

const entetes = () => ({
  "X-API-Key": process.env.GENIUSPAY_PUBLIC_KEY ?? "",
  "X-API-Secret": process.env.GENIUSPAY_SECRET_KEY ?? "",
  Accept: "application/json",
  "Content-Type": "application/json",
});

async function appel(chemin: string, init?: RequestInit) {
  const res = await fetch(`${API}${chemin}`, { ...init, headers: entetes(), signal: AbortSignal.timeout(30000) });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("GeniusPay : clés API refusées (vérifie GENIUSPAY_PUBLIC_KEY et GENIUSPAY_SECRET_KEY dans Vercel)");
  if (!res.ok) throw new Error(`GeniusPay : ${json?.message ?? `erreur ${res.status}`}`);
  return (json?.data ?? json) as Record<string, unknown>;
}

/** Code opérateur Cotiz -> code GeniusPay (laisser vide = le client choisit sur la page GeniusPay) */
const OPERATEUR: Partial<Record<PayMethod, string>> = { wave: "wave", orange: "orange_money", mtn: "mtn_money", moov: "moov_money" };

export async function initierGeniuspay(p: {
  transactionId: string;
  groupId: string;
  amount: number;
  description: string;
  successUrl: string;
  errorUrl: string;
  customerName: string;
  customerPhone: string;
  methode?: PayMethod;
  imposerOperateur?: boolean;
}): Promise<{ paymentUrl: string; reference: string }> {
  const d = await appel("/payments", {
    method: "POST",
    body: JSON.stringify({
      amount: p.amount,
      currency: "XOF",
      description: p.description.replace(/[^\p{L}\p{N} .,'-]/gu, " ").slice(0, 120),
      customer: { name: p.customerName, phone: "+225" + p.customerPhone.replace(/\D/g, "").slice(-10) },
      success_url: p.successUrl,
      error_url: p.errorUrl,
      metadata: { cotiz_transaction: p.transactionId, group_id: p.groupId },
      ...((p.imposerOperateur || process.env.GENIUSPAY_OPERATEUR_DIRECT === "1") && p.methode && OPERATEUR[p.methode] ? { payment_method: OPERATEUR[p.methode] } : {}),
    }),
  });
  const url = String(d.payment_url ?? d.checkout_url ?? "");
  const reference = String(d.reference ?? "");
  if (!url || !reference) throw new Error("GeniusPay : réponse incomplète (pas de lien de paiement)");
  return { paymentUrl: url, reference };
}

export type StatutPaiement = "ACCEPTED" | "REFUSED" | "WAITING" | "INCONNU";

export async function lireGeniuspay(reference: string): Promise<{ statut: StatutPaiement; methode?: PayMethod; frais?: number }> {
  const d = await appel(`/payments/${encodeURIComponent(reference)}`);
  const s = String(d.status ?? "").toLowerCase();
  const statut: StatutPaiement =
    s === "completed" || s === "success" || s === "successful" ? "ACCEPTED"
    : ["failed", "cancelled", "canceled", "expired"].includes(s) ? "REFUSED"
    : s ? "WAITING" : "INCONNU";
  const m = String(d.payment_method ?? d.gateway ?? "").toLowerCase();
  const methode: PayMethod | undefined = m.includes("wave") ? "wave" : m.includes("orange") || m === "om" ? "orange" : m.includes("mtn") || m.includes("momo") ? "mtn" : m.includes("moov") || m.includes("flooz") ? "moov" : undefined;
  const frais = Number(d.fees);
  return { statut, methode, frais: Number.isFinite(frais) ? frais : undefined };
}

/** Signature du webhook : HMAC-SHA256 (hexadécimal) du corps brut, en-tête X-GeniusPay-Signature */
export function signatureValide(corps: string, signature: string | null) {
  const secret = process.env.GENIUSPAY_WEBHOOK_SECRET;
  if (!secret) return null; // pas de secret configuré : on ne peut pas vérifier (on revérifie alors auprès de l'API)
  if (!signature) return false;
  const attendu = createHmac("sha256", secret).update(corps).digest("hex");
  const a = Buffer.from(attendu), b = Buffer.from(signature.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}
