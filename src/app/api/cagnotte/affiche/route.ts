// Refaire l'affiche d'une cagnotte (après publication, changement de photo, de message…)
import { NextResponse } from "next/server";
import { regenererAffiche } from "@/lib/server/regenererAffiche";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const corps = (await req.json().catch(() => null)) as { slug?: string } | null;
  const slug = String(corps?.slug ?? "");
  const lien = await regenererAffiche(slug).catch((e) => { console.error("Affiche", (e as Error).message); return null; });
  return NextResponse.json({ ok: !!lien, lien });
}
