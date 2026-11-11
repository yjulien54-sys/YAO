import { fcfa, normaliserTel } from "./format";
import type { Group, Member, Payment } from "./types";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

export const waLink = (text: string, phone?: string) =>
  `https://wa.me/${phone ? normaliserTel(phone) : ""}?text=${encodeURIComponent(text)}`;

/** Lien d'invitation : avec la clé du créateur/trésorier on entre directement, sinon on note qui a invité */
export function invitation(g: Group, qui: { cle?: string | null; par?: string | null } = {}) {
  const suite = qui.cle ? `?i=${qui.cle}` : qui.par ? `?par=${qui.par}` : "";
  const quoi = g.type === "tontine" ? "notre tontine" : g.type === "association" ? "notre association" : "notre collecte";
  const texte = `Bonjour à tous 👋\n\nPour ${quoi} *${g.name}*, on utilise maintenant *Cotiz* : chacun voit qui a payé et combien il y a dans la caisse. Tout est transparent ✅\n\n1️⃣ Ouvre ce lien 👇\n${origin()}/groupes/${g.id}${suite}\n2️⃣ Inscris-toi avec ton nom et ton numéro\n3️⃣ Quand tu paies ta part (Wave, Orange Money…), touche « Payer ma part » dans l’application\n\nC’est gratuit. En cas de souci, il y a un bouton « Aide » dans l’application.`;
  return waLink(texte);
}

export function partageRecu(g: Group, m: Member, p: Payment) {
  const texte = `✅ *Reçu Cotiz*\n\n${g.name}\n${m.name} a payé *${fcfa(p.amount + p.penalty)}*${g.type !== "collecte" ? ` (tour ${p.round})` : ""}\nRéf : ${p.reference}\n\n${origin()}/groupes/${g.id}/recu/${p.id}`;
  return waLink(texte);
}
