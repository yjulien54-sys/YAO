import { NextResponse } from "next/server";

/** Retour depuis la page CinetPay (GET ou POST) -> page de suivi du paiement */
function rediriger(req: Request) {
  const u = new URL(req.url);
  const tx = u.searchParams.get("tx") ?? "";
  const g = u.searchParams.get("g") ?? "";
  return NextResponse.redirect(new URL(`/groupes/${g}/paiement?tx=${encodeURIComponent(tx)}`, u.origin), 303);
}

export const GET = rediriger;
export const POST = rediriger;
