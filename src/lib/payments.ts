import type { PayMethod } from "./types";

export const OPERATEURS: { id: Exclude<PayMethod, "especes">; nom: string; bg: string; fg: string }[] = [
  { id: "wave", nom: "Wave", bg: "#1DC4FF", fg: "#ffffff" },
  { id: "orange", nom: "Orange Money", bg: "#FF7900", fg: "#ffffff" },
  { id: "mtn", nom: "MTN MoMo", bg: "#FFCC00", fg: "#1a1a1a" },
  { id: "moov", nom: "Moov Money", bg: "#0066B3", fg: "#ffffff" },
];

/**
 * Mode de paiement :
 *  - "manuel" (par défaut) : le membre envoie l'argent au trésorier avec son Wave/Orange Money,
 *    déclare son paiement, et le trésorier le confirme.
 *  - "wave" (Wave Business), "cinetpay" : paiements automatiques via API.
 *  - "simulation" : démonstration, aucun argent.
 */
const MODE = process.env.NEXT_PUBLIC_PAIEMENT_MODE;
export const MODE_PAIEMENT: "manuel" | "simulation" | "wave" | "cinetpay" =
  MODE === "wave" || MODE === "cinetpay" || MODE === "simulation" ? MODE : "manuel";

/** Frais estimés (pris sur la caisse du groupe) : ≈1 % chez Wave Business, ≈3 % chez les agrégateurs. À ajuster selon ton contrat. */
export const FRAIS_TAUX = Number(process.env.NEXT_PUBLIC_FRAIS_TAUX ?? (MODE_PAIEMENT === "wave" ? "0.01" : "0.03"));
export const fraisMobileMoney = (montant: number, method: PayMethod) =>
  // en mode manuel, c'est le membre qui paie les frais de son transfert : la caisse reçoit le montant exact
  method === "especes" || MODE_PAIEMENT === "manuel" ? 0 : Math.round(montant * FRAIS_TAUX);


export const METHOD_LABEL: Record<PayMethod | "virement" | "cinetpay", string> = {
  wave: "Wave",
  orange: "Orange Money",
  mtn: "MTN MoMo",
  moov: "Moov Money",
  especes: "Espèces",
  virement: "Virement",
  cinetpay: "Mobile Money (CinetPay)",
};

/**
 * Paiement SIMULÉ pour le prototype.
 *
 * En production : appeler une route serveur qui initie le paiement chez un
 * agrégateur agréé (CinetPay, PayDunya…). Cotiz ne détient JAMAIS les fonds :
 * l'argent va directement sur le compte marchand du groupe, et le statut est
 * confirmé par le webhook (notify_url) de l'agrégateur.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function initierPaiement(_args: {
  method: PayMethod;
  phone: string;
  amount: number;
}): Promise<{ ok: true }> {
  await new Promise((r) => setTimeout(r, 2200));
  return { ok: true };
}
