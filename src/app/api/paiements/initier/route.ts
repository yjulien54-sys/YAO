import { NextResponse } from "next/server";
import { roundAmount, roundsToPay } from "@/lib/logic";
import { mapGroup } from "@/lib/mappers";
import { fournisseurConfigure, initierCinetpay, supabaseAdmin, userFromRequest } from "@/lib/server/cinetpay";
import { creerSessionWave } from "@/lib/server/wave";
import { geniuspayConfigure, initierGeniuspay } from "@/lib/server/geniuspay";
import { waveConfigured } from "@/lib/server/wave";
import type { PayMethod } from "@/lib/types";
import { fraisOperateurPour, fraisPour, lirePourcent, lireTranches, lireTranchesPenalite, partCotizPenalite } from "@/lib/fraisService";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!fournisseurConfigure()) return NextResponse.json({ error: "Les vrais paiements ne sont pas encore activés." }, { status: 503 });
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: "non connecté" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { groupId, memberId, rounds, amount, phone, method } = body as { groupId?: string; memberId?: string; rounds?: number[]; amount?: number; phone?: string; method?: PayMethod };
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

  // Fournisseur : en mode mixte, Wave en direct pour Wave, GeniusPay pour Orange / MTN / Moov
  const mode = process.env.NEXT_PUBLIC_PAIEMENT_MODE;
  const fournisseur = mode === "mixte" ? (method === "wave" ? "wave" : "geniuspay") : mode;
  if (mode === "mixte" && ((fournisseur === "wave" && !waveConfigured()) || (fournisseur === "geniuspay" && !geniuspayConfigure()))) {
    return NextResponse.json({ error: fournisseur === "wave" ? "Le paiement Wave n’est pas encore activé : choisis un autre moyen." : "Orange Money, MTN et Moov ne sont pas encore activés : choisis Wave." }, { status: 503 });
  }

  // Frais de service Cotiz (réglés dans /admin → Revenus), calculés ici, jamais par le navigateur
  const { data: reglages } = await sb.from("parametres_app").select("cle, valeur").like("cle", "frais_service_%");
  const r = Object.fromEntries((reglages ?? []).map((x: { cle: string; valeur: string | null }) => [x.cle, x.valeur]));
  const fraisService = reglages?.length && r.frais_service_actif !== "non" ? fraisPour(total, lireTranches(r.frais_service_tranches), lirePourcent(r.frais_service_pourcent)) : 0;
  // Frais de l'opérateur ajoutés au paiement : la caisse du groupe reçoit la cotisation entière
  const fraisOperateur = fraisOperateurPour(total + fraisService, fournisseur);
  const aPayer = total + fraisService + fraisOperateur;
  // Part de Cotiz sur les pénalités payées en ligne (réglée dans /admin → Mes revenus)
  const penalites = lignes.reduce((t, l) => t + l.penalty, 0);
  const penaliteCotiz = partCotizPenalite(penalites, lireTranchesPenalite(r.frais_service_penalite_tranches, r.frais_service_part_penalite));

  const transactionId = `CTZ${Date.now()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const lignesPaiement = lignes.map((l, i) => ({
      group_id: g.id,
      member_id: memberId,
      round: l.round,
      amount: l.amount,
      penalty: l.penalty,
      fees: 0, // les frais sont payés par le membre en plus : rien n'est retiré de la caisse
      method: method && ["wave", "orange", "mtn", "moov"].includes(method) ? method : "wave", // corrigé par l'opérateur réel après confirmation
      status: "en_attente",
      transaction_id: transactionId,
      reference: `${transactionId}-${i + 1}`, // permet de retrouver la transaction au retour
      created_by: user.id,
      ...(i === 0 && fraisService ? { frais_service: fraisService } : {}),
      ...(i === 0 && fraisOperateur ? { frais_operateur: fraisOperateur } : {}),
      ...(i === 0 && penaliteCotiz ? { penalite_cotiz: penaliteCotiz } : {}),
    })) as Record<string, unknown>[];
  let { error } = await sb.from("payments").insert(lignesPaiement);
  // Mises à jour SQL n°23 / n°27 pas encore faites : on enregistre sans les colonnes manquantes
  for (let essai = 0; essai < 4 && error; essai++) {
    const col = ["penalite_cotiz", "frais_operateur", "frais_service"].find((c) => error!.message.includes(c));
    if (!col) break;
    lignesPaiement.forEach((l) => delete l[col]);
    ({ error } = await sb.from("payments").insert(lignesPaiement));
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = new URL(req.url).origin;

  if (fournisseur === "geniuspay") {
    try {
      const { paymentUrl, reference } = await initierGeniuspay({
        transactionId,
        groupId: g.id,
        amount: aPayer,
        description: `Cotiz ${g.name}`,
        successUrl: `${origin}/api/paiements/retour?ref=${transactionId}&g=${g.id}`,
        errorUrl: `${origin}/api/paiements/retour?ref=${transactionId}&g=${g.id}&erreur=1`,
        customerName: membre.name,
        customerPhone: String(phone ?? membre.phone),
        methode: method,
        imposerOperateur: mode === "mixte",
      });
      // On retient la référence GeniusPay pour vérifier le paiement ensuite
      await sb.from("payments").update({ transaction_id: reference }).eq("transaction_id", transactionId);
      return NextResponse.json({ paymentUrl, transactionId: reference });
    } catch (e) {
      await sb.from("payments").update({ status: "echoue" }).eq("transaction_id", transactionId);
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  if (fournisseur === "wave") {
    try {
      const session = await creerSessionWave({
        amount: aPayer,
        clientReference: transactionId,
        successUrl: `${origin}/api/paiements/retour?ref=${transactionId}&g=${g.id}`,
        errorUrl: `${origin}/api/paiements/retour?ref=${transactionId}&g=${g.id}&erreur=1`,
      });
      // On retient l'identifiant de session Wave pour vérifier le paiement ensuite
      await sb.from("payments").update({ transaction_id: session.id }).eq("transaction_id", transactionId);
      return NextResponse.json({ paymentUrl: session.launchUrl, transactionId: session.id });
    } catch (e) {
      await sb.from("payments").update({ status: "echoue" }).eq("transaction_id", transactionId);
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  }

  try {
    const { paymentUrl } = await initierCinetpay({
      transactionId,
      amount: aPayer,
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
