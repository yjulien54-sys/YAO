/**
 * Les styles d'affiche de Sikaklo (lien de cagnotte, invitation dans un groupe…).
 * Chaque groupe reçoit automatiquement SON style (toujours le même à chaque partage),
 * calculé à partir de son identifiant. Le trésorier peut en choisir un autre.
 */
export type ThemeAffiche = {
  nom: string;
  fond: string; // dégradé de fond
  panneau: string; // fond derrière la photo
  texte: string; // texte principal
  texte2: string; // texte secondaire
  etiquette: string; // petite étiquette « CAGNOTTE / INVITATION »
  accent: string; // motif (« Funérailles »…)
  bouton: string; // fond du bouton « Participer / Rejoindre »
  boutonTexte: string;
  jauge: [string, string];
  piste: string; // fond de la jauge
  motif: string[]; // couleurs de la bande de motifs
  pastille: string; // aperçu dans le sélecteur
};

const VERT = "#009e60", ORANGE = "#f77f00", OR = "#f5c400", NOIR = "#1c1917";

export const THEMES: ThemeAffiche[] = [
  { nom: "Émeraude", fond: "linear-gradient(135deg, #3a7a62 0%, #2f6b55 55%, #295f4c 100%)", panneau: "#2f6b55", texte: "#ffffff", texte2: "#e3f3ec", etiquette: "#d3eee2", accent: ORANGE, bouton: ORANGE, boutonTexte: "#ffffff", jauge: [ORANGE, OR], piste: "rgba(255,255,255,0.22)", motif: [VERT, OR, ORANGE, NOIR, VERT, ORANGE], pastille: "linear-gradient(135deg, #3a7a62, #295f4c)" },
  { nom: "Soleil", fond: "linear-gradient(135deg, #fb923c 0%, #f77f00 45%, #c2410c 100%)", panneau: "#c2410c", texte: "#ffffff", texte2: "#fff7ed", etiquette: "#ffffff", accent: "#fef08a", bouton: "#ffffff", boutonTexte: "#c2410c", jauge: ["#fde047", "#ffffff"], piste: "rgba(255,255,255,0.28)", motif: ["#ffffff", "#fde047", "#0b3d2c", "#7c2d12", "#fde047", "#0b3d2c"], pastille: "linear-gradient(135deg, #fb923c, #c2410c)" },
  { nom: "Nuit", fond: "linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6d28d9 100%)", panneau: "#312e81", texte: "#ffffff", texte2: "#e0e7ff", etiquette: "#c7d2fe", accent: OR, bouton: OR, boutonTexte: "#1e1b4b", jauge: [OR, ORANGE], piste: "rgba(255,255,255,0.2)", motif: [OR, ORANGE, "#a78bfa", "#1e1b4b", OR, "#a78bfa"], pastille: "linear-gradient(135deg, #4338ca, #6d28d9)" },
  { nom: "Kente", fond: "linear-gradient(135deg, #1c1917 0%, #292524 60%, #44403c 100%)", panneau: "#1c1917", texte: "#ffffff", texte2: "#e7e5e4", etiquette: "#fde68a", accent: OR, bouton: OR, boutonTexte: NOIR, jauge: [VERT, OR], piste: "rgba(255,255,255,0.18)", motif: [OR, VERT, ORANGE, "#dc2626", OR, VERT], pastille: "linear-gradient(135deg, #1c1917, #57534e)" },
  { nom: "Terre", fond: "linear-gradient(135deg, #b45309 0%, #9a3412 50%, #6b230f 100%)", panneau: "#7c2d12", texte: "#ffffff", texte2: "#fde7d0", etiquette: "#fdba74", accent: "#fbbf24", bouton: VERT, boutonTexte: "#ffffff", jauge: ["#fbbf24", "#fde68a"], piste: "rgba(255,255,255,0.22)", motif: ["#fbbf24", VERT, "#fde7d0", NOIR, "#fbbf24", VERT], pastille: "linear-gradient(135deg, #b45309, #6b230f)" },
  { nom: "Ivoire", fond: "linear-gradient(135deg, #fffbf2 0%, #fdf3e1 60%, #fbe8c8 100%)", panneau: "#fdf3e1", texte: "#0b3d2c", texte2: "#57534e", etiquette: VERT, accent: ORANGE, bouton: VERT, boutonTexte: "#ffffff", jauge: [VERT, OR], piste: "rgba(11,61,44,0.12)", motif: [VERT, OR, ORANGE, NOIR, VERT, ORANGE], pastille: "linear-gradient(135deg, #fffbf2, #fbe8c8)" },
];

/** Le style d'un groupe : celui choisi par le trésorier, sinon un style fixe tiré de son identifiant */
export function themePour(id: string | null | undefined, choix?: number | null): number {
  if (choix != null && choix >= 0 && choix < THEMES.length) return choix;
  if (!id) return 0;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % THEMES.length;
}
