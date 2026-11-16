// Refaire l'affiche d'une cagnotte (après publication, changement de photo, de message…)
import { NextResponse } from "next/server";
import { regenererAffiche } from "@/lib/server/regenererAffiche";
import { garde } from "@/lib/server/securite";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const bloque = await garde(req, "affiche", 10, 600);
  if (bloque) return bloque;
  const corps = (await req.json().catch(() => null)) as { slug?: string } | null;
  const slug = String(corps?.slug ?? "");
  if (!/^[\w-]{3,80}$/.test(slug)) return NextResponse.json({ ok: false }, { status: 400 });
  const lien = await regenererAffiche(slug).catch((e) => { console.error("Affiche", (e as Error).message); return null; });
  return NextResponse.json({ ok: !!lien, lien });
}
