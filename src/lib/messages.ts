/**
 * Messages intelligents : on détecte l'événement (décès, mariage, naissance…)
 * à partir du nom et de la description du groupe, et le moment (bien avant,
 * bientôt, jour J, en retard) à partir de l'échéance. Ces modèles servent
 * directement, ou de secours quand l'IA n'est pas disponible.
 */
import { dateCourte, fcfa, prenom } from "./format";
import { amountDue, dueDate, roundStats, unpaidMembers } from "./logic";
import type { Group, Member } from "./types";

export type Evenement = "deuil" | "mariage" | "naissance" | "sante" | "anniversaire" | "tontine" | "association" | "collecte";
export type Moment = "avance" | "bientot" | "jour" | "retard";
export type TypeMessage = "relance" | "groupe";

export const EVENEMENT_LABEL: Record<Evenement, string> = {
  deuil: "Décès / funérailles",
  mariage: "Mariage",
  naissance: "Naissance / baptême",
  sante: "Maladie / soins",
  anniversaire: "Anniversaire",
  tontine: "Tontine",
  association: "Cotisation d’association",
  collecte: "Collecte",
};

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const MOTS: [Evenement, string[]][] = [
  ["deuil", ["deces", "decede", "funerail", "obseque", "deuil", "enterrement", "inhumation", "veillee", "levee de corps", "condoleance", "rappele a dieu", "repos de l'ame", "disparition de", "defunt"]],
  ["mariage", ["mariage", "noces", "fiancaille", "dot ", "la dot", "union de", "marie"]],
  ["naissance", ["bapteme", "naissance", "sortie de bebe", "accouchement", "nouveau-ne", "nouveau ne"]],
  ["sante", ["malad", "hopital", "operation", "soins", "sante", "hospitalis", "chirurgie"]],
  ["anniversaire", ["anniversaire"]],
];

export function detecterEvenement(g: Pick<Group, "name" | "description" | "type">): Evenement {
  const texte = ` ${sansAccents(`${g.name} ${g.description ?? ""}`)} `;
  for (const [ev, mots] of MOTS) if (mots.some((m) => texte.includes(m))) return ev;
  return g.type;
}

const JOUR = 24 * 3600 * 1000;

export function echeance(g: Group): Date {
  if (g.type === "collecte") {
    const d = new Date(g.startDate);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return dueDate(g, g.currentRound);
}

export function joursRestants(g: Group, now = Date.now()) {
  const fin = echeance(g);
  const debutJourEcheance = new Date(fin);
  debutJourEcheance.setHours(0, 0, 0, 0);
  if (now > fin.getTime()) return -Math.ceil((now - fin.getTime()) / JOUR);
  return Math.max(0, Math.round((debutJourEcheance.getTime() - new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()) / JOUR));
}

export function detecterMoment(g: Group, now = Date.now()): Moment {
  const j = joursRestants(g, now);
  if (j < 0) return "retard";
  if (j === 0) return "jour";
  if (j <= 3) return "bientot";
  return "avance";
}

export interface ContexteMessage {
  type: TypeMessage;
  evenement: Evenement;
  moment: Moment;
  joursRestants: number;
  groupe: string;
  description?: string;
  typeGroupe: Group["type"];
  destinataire?: string; // prénom
  montant?: number; // montant dû (cotisation + pénalité)
  penalite?: number;
  tour?: number;
  echeance: string; // date lisible
  objectif?: number;
  collecte?: number;
  restants?: string[]; // prénoms des retardataires (message de groupe)
  lien: string;
}

export function contexte(g: Group, type: TypeMessage, origin: string, m?: Member): ContexteMessage {
  const due = amountDue(g);
  const st = roundStats(g);
  const evenement = detecterEvenement(g);
  const lien = m ? `${origin}/groupes/${g.id}/payer?membre=${m.id}` : `${origin}/groupes/${g.id}/payer`;
  return {
    type,
    evenement,
    moment: detecterMoment(g),
    joursRestants: joursRestants(g),
    groupe: g.name,
    description: g.description,
    typeGroupe: g.type,
    destinataire: m ? prenom(m.name) : undefined,
    montant: g.type === "collecte" ? undefined : due.total,
    penalite: g.type === "collecte" ? undefined : due.penalty,
    tour: g.type === "collecte" ? undefined : g.currentRound,
    echeance: dateCourte(echeance(g).toISOString()),
    objectif: g.type === "collecte" ? g.target : undefined,
    collecte: st.collected,
    restants: type === "groupe" ? unpaidMembers(g).map((x) => prenom(x.name)) : undefined,
    lien,
  };
}

const quand = (c: ContexteMessage) =>
  c.moment === "jour" ? "aujourd’hui" : c.moment === "bientot" ? (c.joursRestants === 1 ? "demain" : `d’ici ${c.joursRestants} jours (${c.echeance})`) : `avant le ${c.echeance}`;

const progression = (c: ContexteMessage) =>
  c.objectif ? `\n\nOn en est à *${fcfa(c.collecte ?? 0)}* sur ${fcfa(c.objectif)}.` : "";

/** Modèles de messages (sans IA). */
export function messageModele(c: ContexteMessage): string {
  const salut = c.destinataire ? `Bonjour ${c.destinataire}` : "Bonjour à tous";
  const payer = `\n\nTu peux participer directement par Wave, Orange Money, MTN ou Moov ici 👇\n${c.lien}`;
  const payerGroupe = `\n\nParticipez en 1 clic (Wave, Orange Money, MTN, Moov) 👇\n${c.lien}`;
  const p = c.type === "groupe" ? payerGroupe : payer;
  const liste = c.restants?.length ? `\n\nEn attente : ${c.restants.join(", ")}.` : "";

  switch (c.evenement) {
    case "deuil":
      return c.type === "groupe"
        ? `🕊️ *${c.groupe}*\n\nChers tous, dans ce moment douloureux, la famille a besoin de notre soutien. Chaque geste compte, même petit 🙏${progression(c)}${p}\n\nMerci pour votre solidarité.`
        : `${salut} 🙏\n\nComme tu le sais, la famille traverse un moment très douloureux (${c.groupe}). Pour la soutenir, chaque geste compte, même petit.${progression(c)}${p}\n\nMerci du fond du cœur pour ta solidarité 🕊️`;
    case "mariage":
      return c.type === "groupe"
        ? `💍🎉 *${c.groupe}*\n\nLa grande date approche ! Pour que la fête soit belle, on compte sur la participation de chacun${c.objectif ? "" : ` ${quand(c)}`}.${progression(c)}${p}\n\nMerci à tous 🥳`
        : `${salut} 😊💍\n\nOn prépare ${c.groupe} et on compte sur toi pour que la fête soit belle !${c.montant ? ` Ta participation : *${fcfa(c.montant)}*, ${quand(c)}.` : ""}${progression(c)}${p}\n\nMerci beaucoup 🎉`;
    case "naissance":
      return c.type === "groupe"
        ? `👶🎊 *${c.groupe}*\n\nUn heureux événement ! Soutenons ensemble la famille.${progression(c)}${p}\n\nMerci à tous 🙏`
        : `${salut} 😊👶\n\nPour ${c.groupe}, on se mobilise pour soutenir l’heureuse famille.${c.montant ? ` Ta participation : *${fcfa(c.montant)}*, ${quand(c)}.` : ""}${progression(c)}${p}\n\nMerci 🎊`;
    case "sante":
      return c.type === "groupe"
        ? `🤲 *${c.groupe}*\n\nNotre proche a besoin de nous pour ses soins. Chaque geste compte.${progression(c)}${p}\n\nMerci pour votre soutien 🙏`
        : `${salut} 🤲\n\nNotre proche a besoin de soutien pour ses soins (${c.groupe}). Chaque geste compte, même petit.${progression(c)}${p}\n\nMerci beaucoup 🙏`;
    case "anniversaire":
      return `${salut} 🎂\n\nPour ${c.groupe}, on prépare une belle surprise !${c.montant ? ` Ta part : *${fcfa(c.montant)}*, ${quand(c)}.` : ""}${progression(c)}${p}\n\nMerci 🎉`;
    case "collecte":
      return c.type === "groupe"
        ? `📢 *${c.groupe}*\n\nLa collecte continue jusqu’au ${c.echeance}. Chaque participation compte !${progression(c)}${p}`
        : `${salut} 👋\n\nPetit rappel pour « ${c.groupe} » : la collecte se termine le ${c.echeance}. Chaque participation compte !${progression(c)}${p}\n\nMerci 🙏`;
    default: {
      // tontine / association : selon le moment
      const montant = fcfa(c.montant ?? 0);
      if (c.type === "groupe") {
        if (c.moment === "retard")
          return `⏰ *${c.groupe}*\n\nL’échéance du tour ${c.tour} est passée (${c.echeance}).${liste}${c.penalite ? `\nLa pénalité de ${fcfa(c.penalite)} s’applique désormais.` : ""}\n\nMerci de régulariser rapidement pour ne pas bloquer le bénéficiaire 🙏${p}`;
        return `📢 *${c.groupe}*\n\nRappel : les cotisations du tour ${c.tour} sont attendues ${quand(c)}.${liste}${p}\n\nLa liste à jour est visible par tous sur Cotiz ✅`;
      }
      switch (c.moment) {
        case "avance":
          return `${salut} 👋\n\nPour info, ta cotisation de *${montant}* pour « ${c.groupe} » (tour ${c.tour}) est attendue avant le ${c.echeance}. Tu peux déjà payer quand tu veux 😉${payer}`;
        case "bientot":
          return `${salut} 👋\n\nPetit rappel : ta cotisation de *${montant}* pour « ${c.groupe} » est attendue ${quand(c)}.${payer}\n\nMerci ! 🙏`;
        case "jour":
          return `${salut} ☀️\n\nC’est aujourd’hui le dernier jour pour ta cotisation de *${montant}* (« ${c.groupe} », tour ${c.tour}).${payer}\n\nMerci ! 🙏`;
        case "retard":
          return `${salut},\n\nTa cotisation pour « ${c.groupe} » (tour ${c.tour}) était attendue le ${c.echeance} et n’est pas encore arrivée.${c.penalite ? ` Avec la pénalité de retard, le montant est maintenant de *${montant}*.` : ` Montant : *${montant}*.`}\n\nMerci de régulariser rapidement pour ne pas bloquer le bénéficiaire 🙏${payer}`;
      }
    }
  }
}
