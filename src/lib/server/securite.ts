/**
 * Outils de sécurité côté serveur (uniquement dans les routes /api) :
 *  - limite de requêtes par adresse IP ou par compte (mise à jour SQL n°46) ;
 *  - journal des activités suspectes, lu par le fondateur dans l'admin.
 * Si la mise à jour SQL n°46 n'est pas encore faite, rien n'est bloqué (l'application continue de marcher).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

let client: SupabaseClient | null = null;
function serveur(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return null;
  client ??= createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Adresse IP du visiteur (fournie par Vercel) */
export function ipDe(req: Request): string {
  const f = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (f || req.headers.get("x-real-ip") || "inconnue").slice(0, 64);
}

/**
 * true si la demande est autorisée, false si la limite est dépassée.
 * Ex : limiter(`connexion:${ip}`, 10, 600) → 10 essais toutes les 10 minutes.
 */
export async function limiter(cle: string, maxi: number, secondes: number): Promise<boolean> {
  const sb = serveur();
  if (!sb) return true;
  const { data, error } = await sb.rpc("limiter_requete", { k: cle, maxi, secondes });
  if (error) return true; // SQL n°46 pas encore faite : on ne bloque pas
  return data !== false;
}

/** Enregistre une activité suspecte (jamais de mot de passe, de code ni de clé dans le détail) */
export async function alerter(type: string, detail: string, req?: Request, profileId?: string | null): Promise<void> {
  console.warn(`[sécurité] ${type} : ${detail}`);
  const sb = serveur();
  if (!sb) return;
  await sb.rpc("noter_alerte", { typ: type, det: detail, adr: req ? ipDe(req) : null, pid: profileId ?? null }).then(() => {}, () => {});
}

/** Réponse standard quand la limite est dépassée */
export function tropDeDemandes() {
  return NextResponse.json({ ok: false, erreur: "Trop de demandes. Réessayez dans quelques minutes." }, { status: 429, headers: { "Retry-After": "300" } });
}

/** Limite + alerte en une ligne : renvoie la réponse 429 à retourner, ou null si c'est autorisé */
export async function garde(req: Request, nom: string, maxi: number, secondes: number, qui?: string | null): Promise<NextResponse | null> {
  const cle = `${nom}:${qui ?? ipDe(req)}`;
  if (await limiter(cle, maxi, secondes)) return null;
  // Une seule alerte par minute et par personne, pour ne pas remplir le journal
  if (await limiter(`alerte:${cle}`, 1, 60)) await alerter("limite_depassee", `${nom} (${maxi} en ${secondes} s)`, req, qui && /^[0-9a-f-]{36}$/i.test(qui) ? qui : null);
  return tropDeDemandes();
}

export const estUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
