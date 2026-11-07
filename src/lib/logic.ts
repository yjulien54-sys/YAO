import type { Group, Member, MemberStatus, Payment } from "./types";

export const TYPE_LABEL: Record<Group["type"], string> = {
  tontine: "Tontine",
  association: "Association",
  collecte: "Collecte",
};

export function dueDate(g: Group, round: number): Date {
  const d = new Date(g.startDate);
  if (g.frequency === "hebdomadaire") d.setDate(d.getDate() + 7 * (round - 1));
  else if (g.frequency === "mensuelle") d.setMonth(d.getMonth() + (round - 1));
  d.setHours(23, 59, 59, 999);
  return d;
}

export const isLate = (g: Group, round: number) =>
  g.type !== "collecte" && Date.now() > dueDate(g, round).getTime();

export const paymentsOf = (g: Group, memberId: string, round = g.currentRound) =>
  g.payments.filter(
    (p) => p.memberId === memberId && (g.type === "collecte" || p.round === round)
  );

export function memberStatus(g: Group, memberId: string): MemberStatus {
  if (paymentsOf(g, memberId).length > 0) return "paye";
  return isLate(g, g.currentRound) ? "retard" : "attente";
}

export function amountDue(g: Group) {
  const late = isLate(g, g.currentRound);
  const penalty = late ? g.penalty : 0;
  return { base: g.amount, penalty, total: g.amount + penalty };
}

export const sum = (ps: Payment[]) => ps.reduce((s, p) => s + p.amount + p.penalty, 0);

export function roundStats(g: Group) {
  const roundPayments =
    g.type === "collecte" ? g.payments : g.payments.filter((p) => p.round === g.currentRound);
  const collected = sum(roundPayments);
  const expected = g.type === "collecte" ? g.target ?? 0 : g.amount * g.members.length;
  const counts = { paye: 0, attente: 0, retard: 0 };
  g.members.forEach((m) => counts[memberStatus(g, m.id)]++);
  return { collected, expected, counts, progress: expected ? Math.min(1, collected / expected) : 0 };
}

export function beneficiary(g: Group, round = g.currentRound): Member | undefined {
  if (g.type !== "tontine" || g.order.length === 0) return undefined;
  const id = g.order[(round - 1) % g.order.length];
  return g.members.find((m) => m.id === id);
}

export const totalRounds = (g: Group) => (g.type === "tontine" ? g.order.length : undefined);

export const unpaidMembers = (g: Group) =>
  g.members.filter((m) => memberStatus(g, m.id) !== "paye");
