import { NextResponse } from "next/server";
import { reference } from "@/lib/format";
import { roundAmount, roundsToPay } from "@/lib/logic";
import { mapGroup } from "@/lib/mappers";
import { fraisMobileMoney } from "@/lib/payments";
import { cinetpayConfigured, initierCinetpay, supabaseAdmin, userFromRequest } from "@/lib/server/cinetpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!cinetpayConfigured()) return NextResponse.json({ error: "Les vrais paiements ne sont pas encore activés." }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { groupId, memberId, rounds, amount, phone } = body as { groupId?: string; memberId?: string; rounds?: number[]; amount?: number; phone?: string };
  if (!groupId || !memberId) return NextResponse.json({ error: "requête invalide" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: row } = await sb.from("groups").select("*, members(*), payments(*), payouts(*)").eq("id", groupId).single();
  if (!row) return NextResponse.json({ error: "groupe introuvable" }, { status: 404 });
  const g = mapGroup(row);
  if (!g.members.some((m) => m.profileId === user.id)) return NextResponse.json({ error: "tu n’es pas membre de ce groupe" }, { status: 403 });
  const membre = g.members.find((m) => m.id === memberId);
  if (!membre) return NextResponse.json({ error: "membre introuvable" }, { status: 404 });

  // Montants calculés côté serveur (on ne fait pas confiance au navigateur)
  let lignes: { round: number; amount: number; penalty: number }[];
  if (g.type === "collecte") {
    const a = Math.round(Number(amount) || 0);
    if (a < 100) return NextResponse.json({ error: "montant trop faible (100 F minimum)" }, { status: 400 });
    lignes = [{ round: 1, amount: a, penalty: 0 }];
  } else {
    const possibles = roundsToPay(g, memberId);
    const demandes = (Array.isArray(rounds) && rounds.length ? rounds : [possibles[0]]).filter((r) => possibles.includes(r)).slice(0, 12);
    if (!demandes.length) return NextResponse.json({ error: "rien à payer" }, { status: 400 });
    lignes = demandes.map((r) => ({ round: r, amount: roundAmount(g, r).base, penalty: roundAmount(g, r).penalty }));
  }
  const total = lignes.reduce((s, l) => s + l.amount + l.penalty, 0);
  if (total % 5 !== 0) return NextResponse.json({ error: "le montant doit être un multiple de 5 F" }, { status: 400 });

  const transactionId = `CTZ${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { error } = await sb.from("payments").insert(
    lignes.map((l) => ({
      group_id: g.id,
      member_id: memberId,
      round: l.round,
      amount: l.amount,
      penalty: l.penalty,
      fees: fraisMobileMoney(l.amount + l.penalty, "wave"),
      method: "wave", // remplacé par l'opérateur réel après confirmation
      status: "en_attente",
      transaction_id: transactionId,
      reference: reference(),
      created_by: user.id,
    }))
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(req.url).origin;
  try {
    const { paymentUrl } = await initierCinetpay({
      transactionId,
      amount: total,
      description: `Cotiz ${g.name}`,
      notifyUrl: `${origin}/api/paiements/notification`,
      returnUrl: `${origin}/api/paiements/retour?tx=${transactionId}&g=${g.id}`,
      customerName: membre.name,
      customerPhone: String(phone ?? membre.phone).replace(/\D/g, "").slice(-10),
    });
    return NextResponse.json({ paymentUrl, transactionId });
  } catch (e) {
    await sb.from("payments").update({ status: "echoue" }).eq("transaction_id", transactionId);
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
