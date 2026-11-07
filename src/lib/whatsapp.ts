import { dateCourte, fcfa, normaliserTel, prenom } from "./format";
import { amountDue, dueDate, unpaidMembers } from "./logic";
import type { Group, Member, Payment } from "./types";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

export const waLink = (text: string, phone?: string) =>
  `https://wa.me/${phone ? normaliserTel(phone) : ""}?text=${encodeURIComponent(text)}`;

export function relanceMembre(g: Group, m: Member) {
  const due = amountDue(g);
  const lien = `${origin()}/groupes/${g.id}/payer?membre=${m.id}`;
  const texte =
    g.type === "collecte"
      ? `Bonjour ${prenom(m.name)} 👋\n\nPetit rappel pour « ${g.name} ». Chaque geste compte 🙏\n\nTu peux participer directement par Wave, Orange Money, MTN ou Moov ici :\n${lien}\n\nMerci ! — via Cotiz`
      : `Bonjour ${prenom(m.name)} 👋\n\nPetit rappel pour « ${g.name} » : ta cotisation de *${fcfa(due.total)}*${due.penalty ? ` (dont ${fcfa(due.penalty)} de pénalité)` : ""} pour le tour ${g.currentRound} était attendue le ${dateCourte(dueDate(g, g.currentRound).toISOString())}.\n\nTu peux payer directement par Wave, Orange Money, MTN ou Moov ici :\n${lien}\n\nMerci ! — via Cotiz`;
  return waLink(texte, m.phone);
}

export function relanceGroupe(g: Group) {
  const liste = unpaidMembers(g)
    .map((m) => `• ${m.name}`)
    .join("\n");
  const texte = `📢 *${g.name}*\n\nIl reste ${unpaidMembers(g).length} cotisation(s) en attente pour le tour ${g.currentRound} :\n${liste}\n\nPayez en 1 clic ici 👉 ${origin()}/groupes/${g.id}/payer\n\nLa liste à jour est visible par tous sur Cotiz ✅`;
  return waLink(texte);
}

export function invitation(g: Group) {
  const texte = `Rejoins « ${g.name} » sur Cotiz pour suivre les cotisations en toute transparence 👇\n${origin()}/groupes/${g.id}`;
  return waLink(texte);
}

export function partageRecu(g: Group, m: Member, p: Payment) {
  const texte = `✅ *Reçu Cotiz*\n\n${g.name}\n${m.name} a payé *${fcfa(p.amount + p.penalty)}*${g.type !== "collecte" ? ` (tour ${p.round})` : ""}\nRéf : ${p.reference}\n\n${origin()}/groupes/${g.id}/recu/${p.id}`;
  return waLink(texte);
}
