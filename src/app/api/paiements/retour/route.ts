import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/cinetpay";

/** Retour depuis la page de paiement (CinetPay ou Wave, GET ou POST) -> page de suivi */
async function rediriger(req: Request) {
  const u = new URL(req.url);
  const g = u.searchParams.get("g") ?? "";
  let tx = u.searchParams.get("tx") ?? "";
  const ref = u.searchParams.get("ref");
  if (!tx && ref && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Wave : on retrouve l'identifiant de session à partir de notre référence
    const { data } = await supabaseAdmin().from("payments").select("transaction_id").like("reference", `${ref}-%`).limit(1).maybeSingle();
    tx = data?.transaction_id ?? "";
  }
  return NextResponse.redirect(new URL(`/groupes/${g}/paiement?tx=${encodeURIComponent(tx)}`, u.origin), 303);
}

export const GET = rediriger;
export const POST = rediriger;
