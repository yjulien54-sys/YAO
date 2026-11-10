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

/** Paiement déclaré par le membre, pas encore confirmé par le trésorier */
export const isDeclared = (g: Group, memberId: string, round: number) =>
  g.pending.some((p) => p.memberId === memberId && (g.type === "collecte" || p.round === round));

export function memberStatus(g: Group, memberId: string): MemberStatus {
  if (paymentsOf(g, memberId).length > 0) return "paye";
  // Un membre qui a déclaré son paiement n'est jamais « en retard » à cause d'une confirmation tardive
  if (isDeclared(g, memberId, g.currentRound)) return "a_confirmer";
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
  const counts = { paye: 0, a_confirmer: 0, attente: 0, retard: 0 };
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
  for (let r = start; r <= maxRound(g); r++) if (!isPaid(g, memberId, r) && !isDeclared(g, memberId, r)) out.push(r);
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
  g.payouts.find((p) => p.round === round && p.status !== "echoue" && (p.nature ?? "versement") === "versement");

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
  // Si les pénalités ont une autre destination, elles ne vont pas au bénéficiaire du tour
  const penalites = g.penaltyDestination && g.penaltyDestination !== "beneficiaire" ? ps.reduce((s, p) => s + p.penalty, 0) : 0;
  return sum(ps) - feesOf(ps) - penalites;
}

/* ---------- Destination des pénalités ---------- */
export const DESTINATION_PENALITES = {
  beneficiaire: { titre: "Ajoutées à la caisse du tour", desc: "Le bénéficiaire du tour reçoit la pénalité en plus : il est dédommagé du retard." },
  solidarite: { titre: "Caisse de solidarité du groupe", desc: "Pour aider un membre en difficulté (maladie, décès…), payer des frais ou une fête." },
  recompense: { titre: "Récompense en fin de cycle", desc: "Partagées à la fin entre les membres qui ont toujours payé à l’heure." },
  don: { titre: "Don à une cause", desc: "Offertes à des personnes démunies, un orphelinat ou une association choisie par le groupe." },
} as const;

export const NATURE_LABEL = { versement: "Versé à", don: "Don à", solidarite: "Aide solidaire à", recompense: "Récompense à" } as const;

/** Caisse des pénalités (quand elles ne vont pas au bénéficiaire du tour) */
export function caissePenalites(g: Group) {
  if (!g.penaltyDestination || g.penaltyDestination === "beneficiaire") return null;
  const total = g.payments.reduce((s, p) => s + p.penalty, 0);
  const sorties = g.payouts.filter((p) => p.status !== "echoue" && p.nature && p.nature !== "versement");
  const utilise = sorties.reduce((s, p) => s + p.amount, 0);
  return { total, utilise, solde: total - utilise, sorties };
}

/** Membres qui ont toujours payé à l'heure (pour la récompense de fin de cycle) */
export function toujoursPonctuels(g: Group): Member[] {
  return g.members.filter((m) => {
    const ps = g.payments.filter((p) => p.memberId === m.id);
    return ps.length > 0 && ps.every((p) => p.penalty === 0) && impayes(g, m.id).length === 0;
  });
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
    if (!isPaid(g, memberId, r) && !isDeclared(g, memberId, r)) out.push(r);
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
    lignes.push(`Nombre de tours : ${g.order.length}. Mes parts (bras) : ${mesParts.length}.${tours.length ? ` Je reçois la caisse au(x) tour(s) : ${tours.join(", ")}.` : ""}`);
  }
  if (g.penalty > 0) lignes.push(`Pénalité de retard : ${g.penalty.toLocaleString("fr-FR")} F CFA par cotisation en retard.`);
  lignes.push(
    g.type === "tontine"
      ? "Je m’engage à payer toutes mes cotisations à chaque échéance jusqu’au dernier tour, y compris après avoir reçu la caisse. En cas de non-paiement, je reconnais devoir au groupe les sommes impayées."
      : "Je m’engage à payer mes cotisations à chaque échéance. En cas de non-paiement, je reconnais devoir au groupe les sommes impayées."
  );
  return lignes.join("\n");
}

/** Nom d'un membre, y compris s'il a été retiré du groupe (historique) */
export const nomMembre = (g: Group, id?: string | null) =>
  [...g.members, ...(g.anciens ?? [])].find((m) => m.id === id)?.name ?? "Ancien membre";
