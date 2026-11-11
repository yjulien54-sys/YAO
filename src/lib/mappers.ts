import type { Group, Member, Payment, Payout, DemandeVersement } from "./types";

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

export const mapDemandeVersement = (d: any): DemandeVersement => ({
  id: d.id,
  round: d.round,
  memberId: d.member_id,
  beneficiaryName: d.beneficiary_name,
  amount: d.amount,
  method: d.method,
  nature: d.nature ?? "versement",
  note: d.note ?? undefined,
  demandePar: d.demande_par,
  statut: d.statut,
  requis: d.requis,
  date: d.cree_le,
  validations: (d.validations_versement ?? []).map((v: any) => ({ profileId: v.profile_id, accord: v.accord, date: v.le })),
});

export const mapGroup = (r: any): Group => {
  const tous: (Member & { pos: number; attente: boolean; invite: string | null })[] = (r.members ?? [])
    .map((m: any) => ({ id: m.id, profileId: m.profile_id, name: m.name, phone: m.phone, role: m.role, archive: !!m.archive, attente: !!m.en_attente, invite: m.invite_par ?? null, pos: m.turn_position }))
    .sort((a: any, b: any) => a.pos - b.pos);
  const members = tous.filter((m) => !m.archive && !m.attente).map(({ attente: _a, invite: _i, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
  const anciens = tous.filter((m) => m.archive).map(({ pos: _p, attente: _a, invite: _i, ...m }) => m); // eslint-disable-line @typescript-eslint/no-unused-vars
  const demandes = tous.filter((m) => m.attente && !m.archive).map(({ pos: _p, attente: _a, invite, ...m }) => ({ ...m, invitePar: tous.find((x) => invite && x.profileId === invite)?.name })); // eslint-disable-line @typescript-eslint/no-unused-vars
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
    paymentPhoneChangedAt: r.payment_phone_changed_at ?? undefined,
    anciens,
    demandes,
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
    demandesVersement: (r.demandes_versement ?? []).map(mapDemandeVersement).sort((a: DemandeVersement, b: DemandeVersement) => b.date.localeCompare(a.date)),
    createdAt: r.created_at,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */
