/**
 * Intégration GeniusPay — côté serveur uniquement.
 *
 * Variables d'environnement à mettre dans Vercel (Settings > Environment Variables),
 * JAMAIS dans le code ni dans une conversation :
 *   GENIUSPAY_API_KEY         clé API « GPAY-… » (envoyée comme Bearer Token) — Dashboard GeniusPay > Paramètres > API
 *   GENIUSPAY_SECRET_KEY      clé secrète « priv_… » (ancien système, facultative si la clé API suffit)
 *   GENIUSPAY_API_URL         facultatif : https://geniuspay.ci/api/v1/merchant (nouvelle version, par défaut)
 *                             ou https://pay.genius.ci/api/v1/merchant (ancienne version)
 *   GENIUSPAY_WEBHOOK_SECRET  secret du webhook (idem, si GeniusPay en fournit un)
 *   NEXT_PUBLIC_PAIEMENT_MODE=geniuspay   active les vrais paiements dans l'app
 *
 * L'« API Tester » GeniusPay (labpay.genius.ci) montre 2 versions : nouvelle (geniuspay.ci) et ancienne (pay.genius.ci).
 * Points d’entrée repris du kit officiel GeniusPay pour Laravel (base /api/v1/merchant,
 * en-têtes X-API-Key / X-API-Secret, POST /payments, GET /payments/{reference},
 * webhook signé X-GeniusPay-Signature = HMAC-SHA256 du corps brut).
 * ⚠️ À confirmer avec la documentation du Dashboard au moment de l'activation.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { PayMethod } from "../types";

// Nouvelle version de GeniusPay (comptes créés sur geniuspay.ci) ; l'ancienne est pay.genius.ci
const API = (process.env.GENIUSPAY_API_URL || "https://geniuspay.ci/api/v1/merchant").replace(/\/$/, "");
// .trim() : une espace ou un retour à la ligne collé par erreur dans Vercel fait refuser la clé
const AUTRES_API = ["https://geniuspay.ci/api/v1/merchant", "https://pay.genius.ci/api/v1/merchant"];
const CLE_API = () => (process.env.GENIUSPAY_API_KEY || process.env.GENIUSPAY_PUBLIC_KEY || "").trim();
const SECRET = () => (process.env.GENIUSPAY_SECRET_KEY || "").trim();

export const geniuspayConfigure = () => Boolean(CLE_API() && process.env.SUPABASE_SERVICE_ROLE_KEY);

const base = { Accept: "application/json", "Content-Type": "application/json" };
// 3 façons de s'identifier, essayées dans l'ordre si GeniusPay répond 401 :
//  1. nouvelle version : Bearer seul (une ancienne clé secrète envoyée en plus peut faire tout refuser)
//  2. Bearer + X-API-Key + X-API-Secret
//  3. ancienne version : X-API-Key + X-API-Secret
const facons = (): Record<string, string>[] => {
  const k = CLE_API(), sec = SECRET();
  const l: Record<string, string>[] = [{ ...base, Authorization: `Bearer ${k}` }];
  if (sec) l.push({ ...base, Authorization: `Bearer ${k}`, "X-API-Key": k, "X-API-Secret": sec }, { ...base, "X-API-Key": k, "X-API-Secret": sec });
  else l.push({ ...base, "X-API-Key": k });
  return l;
};

/** Description sans danger de la clé (jamais la clé elle-même) pour aider au diagnostic */
const decrireCle = () => {
  const k = CLE_API();
  if (!k) return "aucune clé GENIUSPAY_API_KEY dans Vercel";
  const mode = /live/i.test(k) ? "clé LIVE" : /test|sandbox/i.test(k) ? "clé TEST (sandbox)" : "clé";
  const sec = SECRET();
  return `${mode} commençant par « ${k.slice(0, 5)}… » (${k.length} caractères) ; clé secrète : ${sec ? `« ${sec.slice(0, 5)}… » (${sec.length} caractères)` : "ABSENTE (GENIUSPAY_SECRET_KEY)"}`;
};

let faconOk = 0;
async function appel(chemin: string, init?: RequestInit) {
  const liste = facons();
  let dernier: { status: number; json: Record<string, unknown> } | null = null;
  const bases = [API, ...AUTRES_API.filter((b) => b !== API)];
  for (let i = 0; i < liste.length * bases.length; i++) {
    const idx = (faconOk + i) % (liste.length * bases.length);
    const url = bases[Math.floor(idx / liste.length)];
    const res = await fetch(`${url}${chemin}`, { ...init, headers: liste[idx % liste.length], signal: AbortSignal.timeout(30000) }).catch(() => null);
    if (!res) continue;
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 401 || res.status === 403) { dernier = { status: res.status, json }; continue; }
    faconOk = idx;
    if (!res.ok) { const m = json?.message ?? json?.error; throw new Error(`GeniusPay : ${m ? (typeof m === "string" ? m : JSON.stringify(m).slice(0, 200)) : `erreur ${res.status}`}`); }
    return ((json?.data as Record<string, unknown>) ?? json) as Record<string, unknown>;
  }
  const brut = dernier?.json?.message ?? dernier?.json?.error ?? "";
  const msg = typeof brut === "string" ? brut : JSON.stringify(brut).slice(0, 200);
  throw new Error(`GeniusPay refuse la clé (${dernier?.status}${msg ? ` : ${msg}` : ""}). ${decrireCle()}, adresses essayées : ${bases.join(" et ")}. Vérifie dans Vercel que GENIUSPAY_API_KEY est la clé actuelle du Dashboard GeniusPay (même mode test/live), puis redéploie.`);
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
