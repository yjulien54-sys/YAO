import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { garde } from "@/lib/server/securite";

export const runtime = "nodejs";

/**
 * « Ce numéro a-t-il déjà un compte ? » (à l'inscription).
 * Passe par le serveur avec une limite, pour qu'on ne puisse pas tester des milliers de numéros.
 */
export async function POST(req: Request) {
  const bloque = await garde(req, "numero", 15, 600);
  if (bloque) return bloque;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, cle = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle) return NextResponse.json({ existe: false });
  const tel = String((await req.json().catch(() => null))?.tel ?? "").replace(/\D/g, "").slice(-10);
  if (tel.length !== 10) return NextResponse.json({ existe: false });

  // Qui demande (pour ne pas se trouver soi-même)
  const jeton = req.headers.get("authorization")?.replace(/^Bearer /, "");
  const admin = createClient(url, cle, { auth: { persistSession: false, autoRefreshToken: false } });
  const moi = jeton ? (await admin.auth.getUser(jeton)).data.user?.id ?? null : null;

  let { data, error } = await admin.rpc("numero_a_un_compte_serveur", { tel, moi });
  if (error?.code === "PGRST202") ({ data, error } = await admin.rpc("numero_a_un_compte", { tel })); // SQL n°46 pas encore faite
  if (error) return NextResponse.json({ existe: false });
  const r = data as { existe?: boolean; peut_se_connecter?: boolean } | null;
  return NextResponse.json({ existe: !!r?.existe, peut_se_connecter: !!r?.peut_se_connecter });
}
