import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Bloquer (ou débloquer) un compte au niveau de la connexion.
 * Réservé à l'administrateur : on vérifie son jeton avant d'agir avec la clé serveur.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cle) return NextResponse.json({ ok: false, erreur: "clé serveur absente" }, { status: 503 });

  const jeton = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jeton) return NextResponse.json({ ok: false, erreur: "non connecté" }, { status: 401 });
  const moi = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false } });
  const { data: admin } = await moi.rpc("is_admin");
  if (admin !== true) return NextResponse.json({ ok: false, erreur: "réservé à l’administrateur" }, { status: 403 });

  const corps = await req.json().catch(() => null);
  const id = String(corps?.profileId ?? "");
  const bannir = !!corps?.bannir;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, erreur: "identifiant invalide" }, { status: 400 });

  const serveur = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await serveur.auth.admin.updateUserById(id, { ban_duration: bannir ? "876000h" : "none" });
  if (error) return NextResponse.json({ ok: false, erreur: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
