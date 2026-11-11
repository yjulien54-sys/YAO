import { NextResponse } from "next/server";
import { synchroniserTransaction } from "@/lib/server/cinetpay";
import { geniuspayConfigure, signatureValide } from "@/lib/server/geniuspay";

export const runtime = "nodejs";

/**
 * Webhook GeniusPay (à renseigner dans le Dashboard GeniusPay) :
 *   https://tontine-et-cotise.vercel.app/api/paiements/geniuspay
 *
 * 1. On vérifie la signature X-GeniusPay-Signature (si le secret est configuré).
 * 2. On ne fait JAMAIS confiance au contenu reçu : on relit le paiement
 *    directement chez GeniusPay avant de le marquer comme réussi.
 */
export async function POST(req: Request) {
  if (!geniuspayConfigure()) return NextResponse.json({ ok: false }, { status: 503 });
  const corps = await req.text();
  if (signatureValide(corps, req.headers.get("x-geniuspay-signature")) === false) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let json: { event?: string; data?: { reference?: string } } = {};
  try { json = JSON.parse(corps); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  const reference = String(json?.data?.reference ?? "");
  if (!/^[\w.-]{3,80}$/.test(reference)) return NextResponse.json({ ok: true, ignore: true });
  try {
    const { statut } = await synchroniserTransaction(reference);
    return NextResponse.json({ ok: true, statut });
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

// Vérification que l'URL répond
export async function GET() {
  return NextResponse.json({ ok: true });
}
