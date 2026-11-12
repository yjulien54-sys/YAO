/** Frais de service Cotiz : montant fixe par tranche, ajouté aux paiements EN LIGNE (réglable dans /admin → Revenus). */
export type Tranche = { max: number | null; frais: number };

export const TRANCHES_DEFAUT: Tranche[] = [
  { max: 5000, frais: 50 },
  { max: 20000, frais: 100 },
  { max: 50000, frais: 200 },
  { max: null, frais: 300 },
];

/** Lit les tranches depuis le réglage (texte JSON), sinon les tranches par défaut */
export function lireTranches(valeur?: string | null): Tranche[] {
  try {
    const t = JSON.parse(valeur ?? "");
    if (Array.isArray(t) && t.length && t.every((x) => typeof x?.frais === "number" && (x.max === null || typeof x.max === "number"))) {
      return [...t].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
    }
  } catch {}
  return TRANCHES_DEFAUT;
}

/** Frais pour un montant donné (la première tranche dont le plafond n'est pas dépassé) */
export function fraisPour(montant: number, tranches: Tranche[]): number {
  for (const t of tranches) if (t.max === null || montant < t.max) return Math.max(0, Math.round(t.frais));
  return Math.max(0, Math.round(tranches[tranches.length - 1]?.frais ?? 0));
}
