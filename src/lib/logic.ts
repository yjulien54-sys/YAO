import type { Group, Member, MemberStatus, Payment } from "./types";

/** Libellés des fréquences : choix dans le formulaire, et « par … » */
export const FREQUENCES: { id: Group["frequency"]; label: string; par: string }[] = [
  { id: "quotidienne", label: "Chaque jour", par: "jour" },
  { id: "3jours", label: "Tous les 3 jours", par: "3 jours" },
  { id: "hebdomadaire", label: "Chaque semaine", par: "semaine" },
  { id: "2semaines", label: "Toutes les 2 semaines", par: "2 semaines" },
  { id: "mensuelle", label: "Chaque mois", par: "mois" },
  { id: "trimestrielle", label: "Tous les 3 mois", par: "3 mois" },
  { id: "semestrielle", label: "Tous les 6 mois", par: "6 mois" },
  { id: "annuelle", label: "Chaque année", par: "an" },
];
export const parFrequence = (f: Group["frequency"]) => FREQUENCES.find((x) => x.id === f)?.par ?? "tour";

export const TYPE_LABEL: Record<Group["type"], string> = {
  tontine: "Tontine",
  association: "Association",
  collecte: "Collecte",
};

export function dueDate(g: Group, round: number): Date {
  const d = new Date(g.startDate);
  const n = round - 1;
  const JOURS: Partial<Record<Group["frequency"], number>> = { quotidienne: 1, "3jours": 3, hebdomadaire: 7, "2semaines": 14 };
  const MOIS: Partial<Record<Group["frequency"], number>> = { mensuelle: 1, trimestrielle: 3, semestrielle: 6, annuelle: 12 };
  if (JOURS[g.frequency]) d.setDate(d.getDate() + JOURS[g.frequency]! * n);
  else if (MOIS[g.frequency]) d.setMonth(d.getMonth() + MOIS[g.frequency]! * n);
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

/* ---------- Paiements en avance, arriérés, frais, versements ---------- */

/** Dernier tour qu'on peut payer d'avance */
export const maxRound = (g: Group) => (g.type === "tontine" ? g.order.length : g.currentRound + 11);

export const isPaid = (g: Group, memberId: string, round: number) =>
  g.payments.some((p) => p.memberId === memberId && p.round === round);

export const roundAmount = (g: Group, round: number) => {
  const penalty = isLate(g, round) ? g.penalty : 0;
  return { base: g.amount, penalty, total: g.amount + penalty };
};

/** Tours que ce membre peut payer, dans l'ordre (arriérés d'abord pour une tontine). */
export function roundsToPay(g: Group, memberId: string): number[] {
  if (g.type === "collecte") return [];
  const start = g.type === "tontine" ? 1 : g.currentRound;
  const out: number[] = [];
  for (let r = start; r <= maxRound(g); r++) if (!isPaid(g, memberId, r)) out.push(r);
  return out;
}

/** Tours passés non payés (tontine) */
export const arrears = (g: Group, memberId: string) =>
  g.type === "tontine" ? roundsToPay(g, memberId).filter((r) => r < g.currentRound) : [];

/** Dernier tour payé d'affilée à partir du tour en cours (0 si le tour en cours n'est pas payé). */
export function paidUntil(g: Group, memberId: string) {
  let r = g.currentRound;
  if (!isPaid(g, memberId, r)) return 0;
  while (isPaid(g, memberId, r + 1)) r++;
  return r;
}

export const feesOf = (ps: Payment[]) => ps.reduce((s, p) => s + (p.fees ?? 0), 0);

export const payoutFor = (g: Group, round = g.currentRound) =>
  g.payouts.find((p) => p.round === round && p.status !== "echoue");

/** Caisse : entrées nettes (après frais) moins les versements. */
export function caisse(g: Group) {
  const brut = sum(g.payments);
  const frais = feesOf(g.payments);
  const verse = g.payouts.filter((p) => p.status !== "echoue").reduce((s, p) => s + p.amount, 0);
  return { brut, frais, net: brut - frais, verse, solde: brut - frais - verse };
}

/** Montant net à verser pour le tour en cours (tontine) */
export function netDuTour(g: Group, round = g.currentRound) {
  const ps = g.payments.filter((p) => p.round === round);
  return sum(ps) - feesOf(ps);
}

/* ---------- Droits ---------- */
export const ADD_POLICY_LABEL = {
  tresorier: "Seulement le trésorier",
  gestionnaires: "Le trésorier et les co-gestionnaires",
  tous: "Tous les membres",
} as const;

export const ROLE_LABEL = { tresorier: "Trésorier", gestionnaire: "Co-gestionnaire", membre: "Membre" } as const;

export function droits(g: Group, me?: Member, userId?: string | null) {
  const tresorier = me?.role === "tresorier" || (!!userId && g.createdBy === userId);
  const gestionnaire = tresorier || me?.role === "gestionnaire";
  const peutAjouter =
    tresorier || (gestionnaire && g.addPolicy !== "tresorier") || (!!me && g.addPolicy === "tous");
  return { tresorier, gestionnaire, peutAjouter, peutModifier: gestionnaire };
}

/* ---------- Engagement au règlement et dettes ---------- */

/** Tours impayés d'un membre (tours passés, et le tour en cours s'il est en retard) */
export function impayes(g: Group, memberId: string): number[] {
  if (g.type === "collecte") return [];
  const out: number[] = [];
  for (let r = 1; r <= g.currentRound; r++) {
    if (r === g.currentRound && !isLate(g, r)) break;
    if (!isPaid(g, memberId, r)) out.push(r);
  }
  return out;
}

/** Texte du règlement que le membre accepte (copie figée enregistrée avec sa signature) */
export function texteReglement(g: Group, nom: string, telephone: string, mesParts: Member[]): string {
  const freq = FREQUENCES.find((f) => f.id === g.frequency)?.label.toLowerCase() ?? g.frequency;
  const tours = mesParts
    .map((m) => g.order.indexOf(m.id) + 1)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  const lignes = [
    `Règlement du groupe « ${g.name} » (${TYPE_LABEL[g.type].toLowerCase()}).`,
    `Membre : ${nom}, téléphone ${telephone}.`,
    `Cotisation : ${g.amount.toLocaleString("fr-FR")} F CFA par part, ${freq}, première échéance le ${new Date(g.startDate).toLocaleDateString("fr-FR")}.`,
  ];
  if (g.type === "tontine") {
    lignes.push(`Nombre de tours : ${g.order.length}. Mes parts : ${mesParts.length}.${tours.length ? ` Je reçois la caisse au(x) tour(s) : ${tours.join(", ")}.` : ""}`);
  }
  if (g.penalty > 0) lignes.push(`Pénalité de retard : ${g.penalty.toLocaleString("fr-FR")} F CFA par cotisation en retard.`);
  lignes.push(
    g.type === "tontine"
      ? "Je m’engage à payer toutes mes cotisations à chaque échéance jusqu’au dernier tour, y compris après avoir reçu la caisse. En cas de non-paiement, je reconnais devoir au groupe les sommes impayées."
      : "Je m’engage à payer mes cotisations à chaque échéance. En cas de non-paiement, je reconnais devoir au groupe les sommes impayées."
  );
  return lignes.join("\n");
}
