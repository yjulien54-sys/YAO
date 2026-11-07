import { NextResponse } from "next/server";
import { fournisseurConfigure, synchroniserTransaction, userFromRequest } from "@/lib/server/cinetpay";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!fournisseurConfigure()) return NextResponse.json({ error: "non activé" }, { status: 503 });
  if (!(await userFromRequest(req))) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const tx = new URL(req.url).searchParams.get("tx");
  if (!tx) return NextResponse.json({ error: "tx manquant" }, { status: 400 });
  const { statut, paiements } = await synchroniserTransaction(tx);
  return NextResponse.json({ statut, paiements: paiements.map((p) => ({ id: p.id, status: p.status })) });
}
