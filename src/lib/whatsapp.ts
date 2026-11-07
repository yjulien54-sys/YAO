import { fcfa, normaliserTel } from "./format";
import type { Group, Member, Payment } from "./types";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

export const waLink = (text: string, phone?: string) =>
  `https://wa.me/${phone ? normaliserTel(phone) : ""}?text=${encodeURIComponent(text)}`;

export function invitation(g: Group) {
  const texte = `Rejoins « ${g.name} » sur Cotiz pour suivre les cotisations en toute transparence 👇\n${origin()}/groupes/${g.id}`;
  return waLink(texte);
}

export function partageRecu(g: Group, m: Member, p: Payment) {
  const texte = `✅ *Reçu Cotiz*\n\n${g.name}\n${m.name} a payé *${fcfa(p.amount + p.penalty)}*${g.type !== "collecte" ? ` (tour ${p.round})` : ""}\nRéf : ${p.reference}\n\n${origin()}/groupes/${g.id}/recu/${p.id}`;
  return waLink(texte);
}
