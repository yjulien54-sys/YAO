import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Ajouter un agent du service client (réservé au fondateur).
 * Crée son compte (e-mail + mot de passe provisoire) puis lui donne l'accès « agent » à /admin.
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!cle) return NextResponse.json({ ok: false, erreur: "Clé serveur absente sur Vercel." }, { status: 503 });

  const jeton = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!jeton) return NextResponse.json({ ok: false, erreur: "Non connecté." }, { status: 401 });
  const moi = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jeton}` } }, auth: { persistSession: false } });
  const { data: role, error: e1 } = await moi.rpc("mon_role_admin");
  if (e1) return NextResponse.json({ ok: false, erreur: "Fais d’abord la mise à jour SQL n°17." }, { status: 400 });
  if (role !== "fondateur") return NextResponse.json({ ok: false, erreur: "Réservé au fondateur." }, { status: 403 });

  const corps = await req.json().catch(() => null);
  const email = String(corps?.email ?? "").trim().toLowerCase();
  const nom = String(corps?.nom ?? "").trim().slice(0, 80);
  const mdp = String(corps?.motDePasse ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ ok: false, erreur: "E-mail invalide." }, { status: 400 });
  if (mdp.length < 10) return NextResponse.json({ ok: false, erreur: "Mot de passe trop court (10 caractères minimum)." }, { status: 400 });

  const serveur = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: e2 } = await serveur.auth.admin.createUser({ email, password: mdp, email_confirm: true });
  let existait = false;
  if (e2) {
    if (!/already|registered|exists/i.test(e2.message)) return NextResponse.json({ ok: false, erreur: e2.message }, { status: 500 });
    existait = true; // le compte existe déjà : on lui donne seulement l'accès
  }
  const { error: e3 } = await serveur.from("admins").upsert({ email, nom: nom || null, role: "agent" }, { onConflict: "email", ignoreDuplicates: true });
  if (e3) return NextResponse.json({ ok: false, erreur: e3.message }, { status: 500 });
  const { data: qui } = await moi.auth.getUser(jeton);
  await serveur.from("journal_admin").insert({ admin_email: qui.user?.email ?? null, action: "Agent ajouté", cible: `${nom || "—"} · ${email}`, detail: existait ? "compte déjà existant" : "compte créé" });
  return NextResponse.json({ ok: true, existait });
}
