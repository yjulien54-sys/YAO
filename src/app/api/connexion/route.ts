import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Retrouver son compte sur un nouveau téléphone.
 * Le serveur vérifie numéro + date de naissance + code secret (fonction SQL n°12),
 * puis renvoie un jeton de connexion à usage unique pour ce compte.
 * Nécessite la variable SUPABASE_SERVICE_ROLE_KEY dans Vercel (jamais dans le code).
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return NextResponse.json({ ok: false, raison: "indisponible", detail: "cle_absente" }, { status: 503 });

  const corps = await req.json().catch(() => null);
  const telephone = String(corps?.telephone ?? "").replace(/\D/g, "").slice(-10);
  const code = String(corps?.code ?? "");
  const naissance = String(corps?.naissance ?? "");
  if (telephone.length !== 10 || !/^\d{4}$/.test(code) || !/^\d{4}-\d{2}-\d{2}$/.test(naissance)) {
    return NextResponse.json({ ok: false, raison: "incomplet" }, { status: 400 });
  }

  const admin = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc("connexion_verifier", { telephone, code, naissance });
  if (error) {
    console.error("connexion_verifier", error.code, error.message);
    const detail = error.code === "PGRST202" ? "sql_absent" : error.code === "42501" ? "permission" : /api key|jwt/i.test(error.message) ? "cle_invalide" : "autre";
    return NextResponse.json({ ok: false, raison: detail === "sql_absent" ? "indisponible" : "erreur", detail }, { status: 500 });
  }
  const r = data as { ok: boolean; id?: string; raison?: string; restants?: number };
  if (!r.ok || !r.id) return NextResponse.json({ ok: false, raison: r.raison ?? "faux", restants: r.restants }, { status: 401 });

  // Un numéro = un seul compte : les autres comptes créés avec ce numéro (autre appareil…) sont réunis dans celui-ci
  const { error: ef } = await admin.rpc("fusionner_comptes_numero", { cible: r.id });
  if (ef && ef.code !== "PGRST202") console.error("fusionner_comptes_numero", ef.code, ef.message);

  // Le compte n'a pas d'adresse e-mail (compte créé dans l'application) : on lui en donne une interne,
  // jamais utilisée pour envoyer du courrier, qui permet d'ouvrir une session à distance.
  const { data: u, error: e1 } = await admin.auth.admin.getUserById(r.id);
  if (e1 || !u.user) return NextResponse.json({ ok: false, raison: "erreur" }, { status: 500 });
  let email = u.user.email;
  if (!email) {
    email = `compte-${r.id}@tontine-et-cotise.vercel.app`;
    const { error: e2 } = await admin.auth.admin.updateUserById(r.id, { email, email_confirm: true });
    if (e2) {
      console.error("updateUserById", e2.message);
      return NextResponse.json({ ok: false, raison: "erreur" }, { status: 500 });
    }
  }
  const { data: lien, error: e3 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (e3 || !lien.properties?.hashed_token) {
    console.error("generateLink", e3?.message);
    return NextResponse.json({ ok: false, raison: "erreur" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, jeton: lien.properties.hashed_token });
}
