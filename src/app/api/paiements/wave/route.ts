import { NextResponse } from "next/server";
import { synchroniserTransaction } from "@/lib/server/cinetpay";
import { waveConfigured } from "@/lib/server/wave";
import { garde } from "@/lib/server/securite";

export const runtime = "nodejs";

/**
 * Webhook Wave Business (checkout.session.completed, etc.).
 * On relit toujours la session chez Wave avant de valider : un faux appel ne peut donc rien valider.
 */
export async function POST(req: Request) {
  if (!waveConfigured()) return NextResponse.json({ ok: false }, { status: 503 });
  const bloque = await garde(req, "webhook_wave", 120, 60);
  if (bloque) return bloque;
  const evt = await req.json().catch(() => null);
  const id = evt?.data?.id;
  if (typeof id !== "string" || !/^[\w.-]{3,80}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  await synchroniserTransaction(id);
  return NextResponse.json({ ok: true });
}
