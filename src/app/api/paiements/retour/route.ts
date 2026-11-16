import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/server/cinetpay";
import { estUuid } from "@/lib/server/securite";

/** Retour depuis la page de paiement (CinetPay ou Wave, GET ou POST) -> page de suivi */
async function rediriger(req: Request) {
  const u = new URL(req.url);
  const g = estUuid(u.searchParams.get("g")) ? u.searchParams.get("g")! : "";
  const brut = u.searchParams.get("tx") ?? "";
  let tx = /^[\w.-]{3,80}$/.test(brut) ? brut : "";
  const r0 = u.searchParams.get("ref");
  const ref = r0 && /^[A-Z0-9]{6,40}$/i.test(r0) ? r0 : null;
  if (!g) return NextResponse.redirect(new URL("/groupes", u.origin), 303);
  if (!tx && ref && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Wave : on retrouve l'identifiant de session à partir de notre référence
    const { data } = await supabaseAdmin().from("payments").select("transaction_id").like("reference", `${ref}-%`).limit(1).maybeSingle();
    tx = data?.transaction_id ?? "";
  }
  return NextResponse.redirect(new URL(`/groupes/${g}/paiement?tx=${encodeURIComponent(tx)}`, u.origin), 303);
}

export const GET = rediriger;
export const POST = rediriger;
