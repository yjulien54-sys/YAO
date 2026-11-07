import { NextResponse } from "next/server";
import { cinetpayConfigured, synchroniserTransaction } from "@/lib/server/cinetpay";

export const runtime = "nodejs";

/**
 * Appelé par CinetPay après chaque paiement (notify_url).
 * On ne fait jamais confiance au contenu reçu : on revérifie le statut
 * directement auprès de CinetPay avant de marquer le paiement comme réussi.
 */
export async function POST(req: Request) {
  if (!cinetpayConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  let tx = "";
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("json")) tx = String((await req.json().catch(() => ({})))?.cpm_trans_id ?? "");
  else tx = String((await req.formData().catch(() => null))?.get("cpm_trans_id") ?? "");
  if (!tx) return NextResponse.json({ ok: false }, { status: 400 });
  await synchroniserTransaction(tx);
  return NextResponse.json({ ok: true });
}

// CinetPay vérifie parfois que l'URL répond
export async function GET() {
  return NextResponse.json({ ok: true });
}
