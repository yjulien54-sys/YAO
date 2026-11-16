import { NextResponse } from "next/server";
import { fournisseurConfigure, synchroniserTransaction, userFromRequest } from "@/lib/server/cinetpay";
import { garde } from "@/lib/server/securite";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!fournisseurConfigure()) return NextResponse.json({ error: "non activé" }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });
  const bloque = await garde(req, "statut", 60, 600, user.id);
  if (bloque) return bloque;
  const tx = new URL(req.url).searchParams.get("tx");
  if (!tx || !/^[\w.-]{3,80}$/.test(tx)) return NextResponse.json({ error: "tx manquant" }, { status: 400 });
  const { statut, paiements } = await synchroniserTransaction(tx);
  return NextResponse.json({ statut, paiements: paiements.map((p) => ({ id: p.id, status: p.status })) });
}
