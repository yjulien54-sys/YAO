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

/** Pourcentage en plus (0 à 10 %), lu depuis le réglage */
export function lirePourcent(valeur?: string | null): number {
  const n = Number(String(valeur ?? "0").replace(",", "."));
  return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : 0;
}

/** Frais = montant fixe de la tranche + pourcentage du montant (arrondi au franc) */
export function fraisPour(montant: number, tranches: Tranche[], pourcent = 0): number {
  const t = tranches.find((x) => x.max === null || montant < x.max) ?? tranches[tranches.length - 1];
  return Math.max(0, Math.round(t?.frais ?? 0)) + Math.round((montant * lirePourcent(String(pourcent))) / 100);
}
