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
  const nom = String(corps?.nom ?? "").trim().slice(0, 80);
  const mdp = String(corps?.motDePasse ?? "");
  const telephone = String(corps?.telephone ?? "").replace(/\D/g, "").slice(0, 15) || null;
  const salaire = Number(String(corps?.salaire ?? "").replace(/\D/g, "")) || null;
  const fonctions = Array.isArray(corps?.fonctions) ? corps.fonctions.map((x: unknown) => String(x).trim().slice(0, 60)).filter(Boolean).slice(0, 10) : [];
  if (nom.length < 2) return NextResponse.json({ ok: false, erreur: "Indique le nom de l’agent." }, { status: 400 });
  if (mdp.length < 8) return NextResponse.json({ ok: false, erreur: "Mot de passe trop court (8 caractères minimum)." }, { status: 400 });

  const serveur = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  // Numéro suivant : 2702, 2703… (2701 = fondateur)
  const { data: dernier } = await serveur.from("admins").select("numero").order("numero", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
  const numero = Math.max(Number(dernier?.numero ?? 2701), 2701) + 1;
  // Identifiant de connexion : le numéro (l'adresse ci-dessous n'est pas une vraie boîte mail)
  const email = `agent${numero}@tontine-et-cotise.vercel.app`;
  const { data: cree, error: e2 } = await serveur.auth.admin.createUser({ email, password: mdp, email_confirm: true, user_metadata: { nom, numero } });
  if (e2) return NextResponse.json({ ok: false, erreur: e2.message }, { status: 500 });
  const ligne = { email, nom, role: "agent", numero, telephone, salaire, embauche_le: new Date().toISOString().slice(0, 10) };
  let { error: e3 } = await serveur.from("admins").insert({ ...ligne, fonctions });
  // Mise à jour SQL n°21 pas encore faite : on enregistre sans les fonctions
  if (e3 && /fonctions/.test(e3.message)) ({ error: e3 } = await serveur.from("admins").insert(ligne));
  if (e3 && cree.user) await serveur.auth.admin.deleteUser(cree.user.id); // pas de compte orphelin
  if (e3) return NextResponse.json({ ok: false, erreur: e3.message.includes("numero") ? "Fais d’abord la mise à jour SQL n°18." : e3.message }, { status: 500 });
  const { data: qui } = await moi.auth.getUser(jeton);
  await serveur.from("journal_admin").insert({ admin_email: qui.user?.email ?? null, action: "Agent ajouté", cible: `${nom} · n°${numero}`, detail: salaire ? `salaire ${salaire} F` : null });
  return NextResponse.json({ ok: true, numero, email });
}
