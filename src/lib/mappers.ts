import type { Group, Member, Payment, Payout } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const mapPayment = (p: any): Payment => ({
  id: p.id,
  memberId: p.member_id,
  amount: p.amount,
  penalty: p.penalty,
  method: p.method,
  round: p.round,
  date: p.created_at,
  reference: p.reference,
  fees: p.fees ?? 0,
  transactionId: p.transaction_id ?? undefined,
  status: p.status ?? "reussi",
});

export const mapPayout = (p: any): Payout => ({
  id: p.id,
  round: p.round,
  memberId: p.member_id,
  beneficiaryName: p.beneficiary_name,
  amount: p.amount,
  method: p.method,
  status: p.status,
  nature: p.nature ?? "versement",
  note: p.note ?? undefined,
  reference: p.reference,
  date: p.created_at,
});

export const mapGroup = (r: any): Group => {
  const members: (Member & { pos: number })[] = (r.members ?? [])
    .map((m: any) => ({ id: m.id, profileId: m.profile_id, name: m.name, phone: m.phone, role: m.role, pos: m.turn_position }))
    .sort((a: any, b: any) => a.pos - b.pos);
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    description: r.description ?? undefined,
    amount: r.amount,
    frequency: r.frequency,
    startDate: r.start_date,
    penalty: r.penalty,
    target: r.target ?? undefined,
    members: members.map(({ pos: _pos, ...m }) => m), // eslint-disable-line @typescript-eslint/no-unused-vars
    order: members.map((m) => m.id),
    currentRound: r.current_round,
    payments: (r.payments ?? [])
      .map(mapPayment)
      .filter((p: Payment) => p.status === "reussi")
      .sort((a: Payment, b: Payment) => a.date.localeCompare(b.date)),
    pending: (r.payments ?? []).map(mapPayment).filter((p: Payment) => p.status === "en_attente"),
    paymentPhone: r.payment_phone ?? undefined,
    waveLink: r.wave_link ?? undefined,
    addPolicy: r.add_policy ?? "tresorier",
    createdBy: r.created_by ?? undefined,
    tiragePrevu: r.tirage_prevu ?? undefined,
    tirageFait: r.tirage_fait ?? undefined,
    tiragePar: r.tirage_par ?? undefined,
    penaltyDestination: r.penalty_destination ?? "beneficiaire",
    donCause: r.don_cause ?? undefined,
    engagements: (r.engagements ?? []).map((e: any) => ({
      profileId: e.profile_id,
      nom: e.nom,
      telephone: e.telephone,
      texte: e.texte,
      acceptedAt: e.accepted_at,
    })),
    payouts: (r.payouts ?? []).map(mapPayout).sort((a: Payout, b: Payout) => a.date.localeCompare(b.date)),
    createdAt: r.created_at,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */
