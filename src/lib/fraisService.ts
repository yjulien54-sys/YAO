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

/** Frais estimés de l'opérateur de paiement, ajoutés au montant payé par le membre (la caisse reçoit la cotisation entière) */
export function fraisOperateurPour(montant: number, fournisseur: string | null | undefined): number {
  if (fournisseur === "wave") return Math.round(montant * 0.01);
  if (fournisseur === "geniuspay") return Math.round(montant * 0.025) + 100;
  if (fournisseur === "cinetpay") return Math.round(montant * 0.03);
  return 0;
}

/** Part des pénalités qui revient à Cotiz (0 à 100 %) */
export function lirePartPenalite(valeur?: string | null): number {
  const n = Number(valeur ?? "0");
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}
