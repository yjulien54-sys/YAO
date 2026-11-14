/**
 * Cotiz IA — mode GRATUIT (sans clé payante).
 * Pas d'intelligence artificielle externe : on compare le message du client aux
 * questions fréquentes de Cotiz (mots-clés). Si la réponse est sûre, on l'envoie ;
 * si la demande touche aux données ou à l'argent, ou si on n'est pas sûr, on
 * transmet au personnel. Coût : 0 F.
 */
import { FAQ } from "@/lib/faq";
import { GUIDES, texteGuide } from "@/lib/guideCotiz";

/** Tout ce que Cotiz IA sait expliquer : le guide pas à pas + les questions fréquentes */
const SAVOIR: { q: string; r: string }[] = [
  ...GUIDES.map((g) => ({ q: `${g.titre} ${g.questions.join(" ")}`, r: texteGuide(g) })),
  ...FAQ,
];
/** Nombre de réponses automatiques avant de passer la main à un conseiller */
const MAX_REPONSES_GRATUIT = 3;

export type DecisionIA = { reponse: string; transmettre: boolean; raison: string; resoudre: boolean };

const sansAccents = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ");

const MOTS_VIDES = new Set(("a au aux avec ce ces comment dans de des du elle en est et etre il je j la le les leur lui ma mais me mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y c ca cela cet cette fait faire peut peux veux suis ai as avoir bien bonjour bonsoir salut svp stp merci aide besoin quoi quel quelle quels quelles est-ce si alors donc").split(" "));

/** Familles de mots (pour reconnaître « cotiser », « cotisation », « payer »…) */
const SYNONYMES: Record<string, string[]> = {
  payer: ["paye", "payer", "paiement", "paiements", "payement", "cotiser", "cotisation", "cotisations", "verser", "envoyer", "wave", "orange", "mtn", "moov", "momo"],
  tontine: ["tontine", "tontines", "association", "collecte", "cagnotte"],
  creer: ["creer", "cree", "creation", "ouvrir", "nouveau", "nouvelle", "lancer", "commencer"],
  inviter: ["inviter", "invitation", "ajouter", "ajout", "membre", "membres", "lien", "rejoindre", "entrer"],
  code: ["code", "secret", "pin", "oublie", "oublier", "mot", "passe"],
  telephone: ["telephone", "portable", "phone", "appareil"],
  attente: ["attente", "attendre", "bloque", "confirme", "confirmer", "valider", "valide"],
  tresorier: ["tresorier", "tresoriere", "gestionnaire", "responsable", "chef"],
  penalite: ["penalite", "penalites", "retard", "amende"],
  part: ["part", "parts", "bras", "plusieurs"],
  avance: ["avance", "anticiper", "tours", "tour"],
  installer: ["installer", "iphone", "android", "telecharger", "application", "appli"],
  frais: ["frais", "commission", "cout", "coute", "prix", "combien", "gratuit"],
  oeil: ["oeil", "cacher", "masquer", "montant", "caisse"],
  securite: ["securite", "protege", "proteger", "donnees", "confidentialite", "vole"],
};
const famille = (mot: string) => Object.entries(SYNONYMES).find(([, l]) => l.includes(mot))?.[0] ?? mot;

const mots = (t: string) => sansAccents(t).split(/[^a-z0-9]+/).filter((m) => m.length > 2 && !MOTS_VIDES.has(m));
/** Mots exacts + familles de mots (préfixées « # ») */
const motsCles = (t: string) => { const l = mots(t); return new Set([...l, ...l.map((m) => "#" + famille(m))]); };

/** « Comment faire… ? » : une demande d'explication (Cotiz IA peut répondre) et non une action à faire */
const QUESTION_PRATIQUE = /^(comment|ou |ou est|ou se|c.?est quoi|qu.?est.?ce|est.?ce que je peux|je peux|on peut|peut.?on|je veux savoir|explique|aide.?moi a)/;

/** Le client demande à Cotiz IA de FAIRE une action à sa place : elle explique, mais ne fait rien */
const ACTION_INTERDITE = /(supprime|efface|retire|enleve|exclu|valide|confirme|annule|rembourse|change|modifie|debloque|verse|transfere)[sz]?(-moi|-le|-la| moi| le| la| mon| ma| mes| son| sa| ce| cette| un| une)/;

/** Demandes qu'un robot ne doit jamais traiter seul (même formulées comme une question) */
const SENSIBLE: [RegExp, string][] = [
  [/rembours|argent (pas|non) (recu|arrive)|pas recu|n.?ai pas recu|manque|disparu|vole|perdu (mon|l.?) argent/, "argent manquant ou remboursement"],
  [/arnaque|escroc|fraude|faux recu|menace|police|avocat|plainte|justice/, "arnaque, fraude ou plainte"],
  [/bloque|suspendu|desactive/, "compte bloqué"],
  [/changer (de |mon )?(numero|nom|date)|mauvais (numero|nom)|corriger (mon|le) (numero|nom)|date de naissance/, "modification de données personnelles"],
  [/parler a (un|une) (humain|personne|agent|conseiller)|un humain|vrai agent|conseiller/, "le client demande un conseiller"],
  [/suggestion|idee|ameliorer|proposition/, "suggestion à lire par l’équipe"],
];

/** Sujets d'argent à vérifier par un humain, SAUF si c'est une simple question « comment faire » */
const SENSIBLE_SAUF_QUESTION: [RegExp, string][] = [
  [/confirmer (mon|le|un) paiement|valider (mon|le) paiement|annuler (un|le|mon) paiement|deux fois|double paiement/, "paiement à vérifier"],
  [/versement|beneficiaire|pas (ete )?verse/, "versement à vérifier"],
];

const MERCI = /^(merci|ok|okay|d.?accord|c.?est bon|c.?est regle|resolu|super|parfait|top|cool|thank)/;

const TRANSMIS = "Je transmets ta demande à un conseiller du service client : il va te répondre ici très bientôt. Si c’est à propos d’un paiement, prépare le nom du groupe, le montant, la date et la référence de la transaction (jamais ton code secret).";

/**
 * @param messages du plus ancien au plus récent ; le dernier est celui du client
 */
export function repondreGratuit(motif: string, messages: { auteur: string; texte: string }[]): DecisionIA {
  const dernier = messages[messages.length - 1]?.texte ?? "";
  const brut = sansAccents(dernier).trim();
  const dejaRepondu = messages.some((m) => m.auteur === "ia");

  // Le client remercie après une réponse : on clôt
  if (dejaRepondu && MERCI.test(brut) && brut.length < 80) {
    return { reponse: "Avec plaisir ! N’hésite pas à revenir ici si tu as une autre question. Bonne journée avec Cotiz 🙏", transmettre: false, raison: "", resoudre: true };
  }
  const nbIA = messages.filter((m) => m.auteur === "ia").length;
  if (nbIA >= MAX_REPONSES_GRATUIT) return { reponse: TRANSMIS, transmettre: true, raison: "Plusieurs questions : à reprendre par un agent", resoudre: false };

  const texteComplet = sansAccents(`${motif} ${dernier}`);
  const pratique = QUESTION_PRATIQUE.test(brut);
  for (const [motif_, raison] of SENSIBLE) if (motif_.test(texteComplet)) return { reponse: TRANSMIS, transmettre: true, raison, resoudre: false };
  if (!pratique) for (const [motif_, raison] of SENSIBLE_SAUF_QUESTION) if (motif_.test(texteComplet)) return { reponse: TRANSMIS, transmettre: true, raison, resoudre: false };
  // « Supprime mon compte », « valide mon paiement »… : Cotiz IA n'agit jamais à la place du client
  const action = !pratique && ACTION_INTERDITE.test(brut);
  if (/arnaque|probleme grave/.test(sansAccents(motif))) return { reponse: TRANSMIS, transmettre: true, raison: "arnaque ou problème grave", resoudre: false };
  if (/suggestion/.test(sansAccents(motif))) return { reponse: "Merci pour ton idée ! Je la transmets à l’équipe Cotiz qui lit toutes les suggestions.", transmettre: true, raison: "suggestion à lire par l’équipe", resoudre: false };

  // Recherche de la question fréquente la plus proche
  const cles = motsCles(dernier);
  let meilleur = { score: 0, i: -1 };
  SAVOIR.forEach((f, i) => {
    const q = motsCles(f.q), r = motsCles(f.r);
    let score = 0;
    cles.forEach((m) => {
      const fam = m.startsWith("#");
      if (q.has(m)) score += fam ? 2 : 3;
      else if (r.has(m)) score += fam ? 0.5 : 1;
    });
    if (score > meilleur.score) meilleur = { score, i };
  });
  const trouve = meilleur.i >= 0 && meilleur.score >= 5;
  if (action) {
    // Elle explique comment le client peut le faire lui-même ; sinon un conseiller regarde
    const intro = "Je ne peux pas faire cette action à ta place : par sécurité, Cotiz IA ne supprime rien, ne valide aucun paiement et ne modifie aucune donnée.";
    if (trouve) return { reponse: `${intro} Voici comment tu peux le faire toi-même :\n\n${SAVOIR[meilleur.i].r}\n\nSi tu as besoin d’un conseiller, écris-le-moi.`, transmettre: false, raison: "", resoudre: false };
    return { reponse: `${intro} ${TRANSMIS}`, transmettre: true, raison: "Le client demande une action sur son compte ou ses paiements", resoudre: false };
  }
  if (!trouve) return { reponse: TRANSMIS, transmettre: true, raison: dejaRepondu ? "Autre question après la réponse automatique" : "Question hors des réponses automatiques", resoudre: false };

  const f = SAVOIR[meilleur.i];
  return {
    reponse: `${f.r}\n\nEst-ce que ça répond à ta question ? Si oui, écris « merci ». Tu peux aussi me poser une autre question, ou écrire « conseiller » pour parler à une personne.`,
    transmettre: false, raison: "", resoudre: false,
  };
}
