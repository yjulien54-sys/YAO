/**
 * Intégration CinetPay (API Checkout v2) — côté serveur uniquement.
 *
 * Variables d'environnement (Vercel > Settings > Environment Variables) :
 *   CINETPAY_APIKEY, CINETPAY_SITE_ID   : fournies par CinetPay (compte marchand)
 *   SUPABASE_SERVICE_ROLE_KEY           : clé "service_role" de Supabase (secrète !)
 *   NEXT_PUBLIC_PAIEMENT_MODE=cinetpay  : active les vrais paiements dans l'app
 *
 * ⚠️ À vérifier avec la documentation CinetPay au moment de l'activation
 * (noms des champs, valeurs de statut, codes opérateurs).
 */
import { createClient } from "@supabase/supabase-js";
import type { PayMethod } from "../types";

const API = "https://api-checkout.cinetpay.com/v2";

export const cinetpayConfigured = () =>
  Boolean(process.env.CINETPAY_APIKEY && process.env.CINETPAY_SITE_ID && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Un fournisseur de paiement réel est-il configuré ? */
export const fournisseurConfigure = () =>
  process.env.NEXT_PUBLIC_PAIEMENT_MODE === "wave"
    ? Boolean(process.env.WAVE_API_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
    : cinetpayConfigured();

/** Client Supabase avec tous les droits — ne jamais l'utiliser côté navigateur. */
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/** Utilisateur connecté à partir du jeton envoyé par l'app */
export async function userFromRequest(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await sb.auth.getUser(token);
  return data.user ?? null;
}

export async function initierCinetpay(p: {
  transactionId: string;
  amount: number;
  description: string;
  notifyUrl: string;
  returnUrl: string;
  customerName: string;
  customerPhone: string;
}): Promise<{ paymentUrl: string }> {
  const res = await fetch(`${API}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: process.env.CINETPAY_APIKEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: p.transactionId,
      amount: p.amount,
      currency: "XOF",
      description: p.description.replace(/[^\p{L}\p{N} .,'-]/gu, " ").slice(0, 120),
      notify_url: p.notifyUrl,
      return_url: p.returnUrl,
      channels: "MOBILE_MONEY",
      lang: "fr",
      customer_name: p.customerName,
      customer_surname: p.customerName,
      customer_phone_number: p.customerPhone,
    }),
  });
  const json = await res.json().catch(() => ({}));
  const url = json?.data?.payment_url;
  if (!url) throw new Error(`CinetPay : ${json?.message ?? `erreur ${res.status}`}`);
  return { paymentUrl: url };
}

export type StatutCinetpay = "ACCEPTED" | "REFUSED" | "WAITING" | "INCONNU";

export async function verifierCinetpay(transactionId: string): Promise<{ statut: StatutCinetpay; methode?: string }> {
  const res = await fetch(`${API}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: process.env.CINETPAY_APIKEY, site_id: process.env.CINETPAY_SITE_ID, transaction_id: transactionId }),
  });
  const json = await res.json().catch(() => ({}));
  const s = String(json?.data?.status ?? "").toUpperCase();
  const statut: StatutCinetpay = s === "ACCEPTED" ? "ACCEPTED" : s === "REFUSED" || s === "CANCELED" ? "REFUSED" : s ? "WAITING" : "INCONNU";
  return { statut, methode: json?.data?.payment_method };
}

/** Code opérateur CinetPay -> moyen de paiement Cotiz */
export function methodeDepuisCinetpay(code?: string): PayMethod | undefined {
  const c = (code ?? "").toUpperCase();
  if (c.includes("WAVE")) return "wave";
  if (c.includes("OM") || c.includes("ORANGE")) return "orange";
  if (c.includes("MOMO") || c.includes("MTN")) return "mtn";
  if (c.includes("FLOOZ") || c.includes("MOOV")) return "moov";
  return undefined;
}

/** Vérifie une transaction chez le fournisseur (CinetPay ou Wave) et met à jour les paiements. */
export async function synchroniserTransaction(transactionId: string) {
  const sb = supabaseAdmin();
  let statut: StatutCinetpay;
  let m: PayMethod | undefined;
  if (transactionId.startsWith("cos-") || process.env.NEXT_PUBLIC_PAIEMENT_MODE === "wave") {
    const { lireSessionWave } = await import("./wave");
    statut = await lireSessionWave(transactionId);
    m = "wave";
  } else {
    const r = await verifierCinetpay(transactionId);
    statut = r.statut;
    m = methodeDepuisCinetpay(r.methode);
  }
  if (statut === "ACCEPTED") {
    await sb
      .from("payments")
      .update({ status: "reussi", ...(m ? { method: m } : {}) })
      .eq("transaction_id", transactionId)
      .eq("status", "en_attente");
  } else if (statut === "REFUSED") {
    await sb.from("payments").update({ status: "echoue" }).eq("transaction_id", transactionId).eq("status", "en_attente");
  }
  const { data } = await sb.from("payments").select("id, group_id, status").eq("transaction_id", transactionId);
  return { statut, paiements: data ?? [] };
}
