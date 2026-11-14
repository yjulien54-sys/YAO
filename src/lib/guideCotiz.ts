/**
 * Guide pas à pas de l'application Cotiz : c'est ce que « Cotiz IA » apprend pour expliquer
 * aux clients comment faire (s'inscrire, créer un groupe, inviter, payer…).
 *
 * Pour apprendre une nouvelle chose à Cotiz IA : ajouter un bloc ici.
 *  - questions : différentes façons dont les gens posent la question (plus il y en a, mieux elle comprend)
 *  - etapes : la marche à suivre, une étape par ligne
 *  - note : une précision utile (facultatif)
 *
 * Cotiz IA EXPLIQUE seulement. Elle ne fait aucune action à la place du client :
 * elle ne supprime rien, ne valide aucun paiement, ne change aucune donnée.
 */
export type Guide = { id: string; titre: string; questions: string[]; etapes: string[]; note?: string };

export const GUIDES: Guide[] = [
  {
    id: "inscription",
    titre: "S’inscrire sur Cotiz",
    questions: ["comment s’inscrire", "comment créer un compte", "je veux m’inscrire", "ouvrir un compte cotiz", "comment commencer sur cotiz", "inscription"],
    etapes: [
      "Ouvrez Cotiz (application Android ou tontine-et-cotise.vercel.app).",
      "Sur la page d’accueil, écrivez votre nom, votre date de naissance et votre numéro de téléphone (10 chiffres).",
      "Touchez « Continuer ».",
      "Créez votre code secret Cotiz à 4 chiffres (ce n’est pas votre code Mobile Money).",
    ],
    note: "Utilisez le même numéro que celui donné au trésorier de votre groupe : vous retrouvez alors automatiquement vos groupes.",
  },
  {
    id: "autre-appareil",
    titre: "Se connecter sur un autre téléphone ou un ordinateur",
    questions: ["se connecter sur ordinateur", "j’ai changé de téléphone", "nouveau téléphone", "connexion sur pc", "retrouver mon compte", "je ne vois pas mes groupes sur l’ordinateur", "deux comptes", "même compte sur téléphone et ordinateur", "se connecter à mon compte"],
    etapes: [
      "Sur la page d’accueil de Cotiz, touchez « J’ai déjà un compte (autre téléphone, ordinateur) ».",
      "Écrivez votre numéro, votre date de naissance et votre code secret Cotiz.",
      "Touchez « Retrouver mon compte » : vous retrouvez tous vos groupes, avec les mêmes droits.",
    ],
    note: "Ne créez pas un deuxième compte avec le même numéro. Si Cotiz vous indique « Ce numéro a déjà un compte », touchez « Me connecter à mon compte ». Si votre date de naissance n’est pas encore enregistrée, ajoutez-la d’abord sur votre premier appareil : Profil → Sécurité.",
  },
  {
    id: "creer-groupe",
    titre: "Créer un groupe (tontine, association ou collecte)",
    questions: ["comment créer un groupe", "créer une tontine", "créer une association", "créer une collecte", "créer une cotisation", "ouvrir une tontine", "lancer une tontine", "nouveau groupe"],
    etapes: [
      "Dans « Mes groupes », touchez « Créer » (ou « Nouveau »).",
      "Choisissez le type : Tontine (un membre ramasse à chaque tour), Association (caisse commune) ou Collecte (funérailles, mariage, baptême, projet…).",
      "Donnez un nom au groupe, puis remplissez le montant, la fréquence et la 1ère échéance (ou l’objectif et la date limite pour une collecte).",
      "Validez : vous devenez automatiquement le trésorier du groupe.",
      "Ajoutez ensuite les membres ou envoyez-leur le lien d’invitation.",
    ],
  },
  {
    id: "inviter",
    titre: "Inviter ou ajouter des membres",
    questions: ["comment inviter", "inviter des membres", "inviter les gens", "inviter dans ma tontine", "inviter mes amis", "inviter ma famille", "ajouter un membre", "ajouter des personnes", "envoyer le lien du groupe", "faire entrer quelqu’un dans le groupe", "partager le groupe"],
    etapes: [
      "Ouvrez le groupe.",
      "Touchez « Inviter » : un message WhatsApp est prêt avec le lien du groupe. Envoyez-le à la personne ou dans votre groupe WhatsApp.",
      "La personne ouvre le lien, s’inscrit avec son numéro et entre dans le groupe.",
    ],
    note: "Si c’est le créateur ou le trésorier qui invite, la personne entre directement. Si c’est un autre membre, la demande attend que le trésorier l’accepte. Le trésorier peut aussi taper le nom et le numéro de la personne dans Réglages → « Ajouter un membre ».",
  },
  {
    id: "rejoindre",
    titre: "Rejoindre un groupe",
    questions: ["comment rejoindre un groupe", "j’ai reçu un lien d’invitation", "rejoindre avec le lien", "je ne vois pas le groupe où on m’a ajouté"],
    etapes: [
      "Ouvrez le lien d’invitation reçu sur WhatsApp.",
      "Inscrivez-vous (ou connectez-vous) avec votre numéro de téléphone.",
      "Le groupe apparaît dans « Mes groupes ». Si le lien vient d’un simple membre, attendez que le trésorier accepte votre demande.",
    ],
    note: "Si le trésorier vous a ajouté avec votre numéro, il suffit de vous inscrire avec ce même numéro : le groupe apparaît tout seul.",
  },
  {
    id: "payer",
    titre: "Payer sa cotisation",
    questions: ["comment payer", "payer ma cotisation", "payer ma part", "comment cotiser", "envoyer mon argent", "payer avec wave", "payer avec orange money", "payer avec mtn", "payer avec moov", "participer à la collecte"],
    etapes: [
      "Ouvrez le groupe et touchez « Payer ma part » (ou « Participer » pour une collecte).",
      "Choisissez votre moyen de paiement : Wave, Orange Money, MTN MoMo ou Moov Money.",
      "Suivez l’écran : le paiement s’ouvre avec le bon montant (ou le numéro du trésorier est copié).",
      "Vérifiez le nom du destinataire, validez avec votre code Mobile Money dans l’application de votre opérateur.",
      "Revenez dans Cotiz et touchez « J’ai envoyé » si on vous le demande.",
    ],
    note: "Cotiz ne vous demandera jamais votre code secret Mobile Money. Votre paiement apparaît « en attente » jusqu’à ce que le trésorier confirme l’avoir reçu.",
  },
  {
    id: "confirmer-paiement",
    titre: "Confirmer un paiement reçu (trésorier)",
    questions: ["comment confirmer un paiement", "valider un paiement", "le paiement est en attente", "comment le trésorier confirme", "marquer comme payé"],
    etapes: [
      "Le trésorier vérifie d’abord sur son téléphone (Wave, Orange Money…) qu’il a bien reçu l’argent.",
      "Dans le groupe, il touche « Reçu » à côté du paiement en attente.",
      "Le paiement passe à « Payé » et un reçu est créé pour le membre.",
    ],
    note: "Seul le trésorier peut confirmer un paiement : ni Cotiz IA ni les membres ne peuvent le faire à sa place.",
  },
  {
    id: "remettre-fonds",
    titre: "Remettre les fonds / verser la caisse (trésorier)",
    questions: ["comment remettre les fonds", "verser la caisse", "envoyer l’argent au bénéficiaire", "rapatrier les fonds", "sortie de caisse", "comment donner l’argent de la collecte", "je ne vois pas le bouton pour verser"],
    etapes: [
      "Ouvrez le groupe (vous devez être le trésorier).",
      "Touchez « Remettre les fonds » (collecte), « Verser la caisse » (tontine) ou « Enregistrer une sortie » (association).",
      "Envoyez d’abord l’argent au bénéficiaire avec votre Mobile Money, puis indiquez le montant et le moyen utilisé.",
      "Validez : tout le groupe voit le versement dans l’historique.",
    ],
    note: "Si vous ne voyez pas ce bouton, vérifiez que vous êtes connecté avec le compte qui a créé le groupe (même numéro). Sur un autre appareil, utilisez « J’ai déjà un compte » au lieu de créer un nouveau compte.",
  },
  {
    id: "cagnotte",
    titre: "Publier une cagnotte publique (collecte)",
    questions: ["comment publier la cagnotte", "cagnotte publique", "partager la collecte sur whatsapp", "mettre une photo sur la cagnotte", "page de la cagnotte", "lien de la cagnotte", "motif de la cagnotte"],
    etapes: [
      "Ouvrez votre collecte et touchez la bannière orange « Publier la cagnotte » (ou Réglages → Cagnotte).",
      "Ajoutez une photo, placez-la comme vous le souhaitez, puis validez.",
      "Écrivez le motif (ex : Funérailles, Solidarité du village) et un message qui explique à quoi sert l’argent.",
      "Touchez « Publier », puis « Partager » pour envoyer le lien sur WhatsApp.",
    ],
    note: "Toute personne qui a le lien peut voir la page et participer, même sans avoir Cotiz.",
  },
  {
    id: "ordre-tirage",
    titre: "Ordre de passage et tirage au sort (tontine)",
    questions: ["changer l’ordre de passage", "qui ramasse en premier", "tirage au sort", "modifier l’ordre des tours", "ordre des bénéficiaires"],
    etapes: [
      "Ouvrez la tontine, touchez « Réglages ».",
      "Dans « Ordre de passage », déplacez les membres dans l’ordre voulu, puis « Enregistrer l’ordre ».",
      "Ou programmez un tirage au sort public : tout le groupe voit le résultat.",
    ],
    note: "Seuls le trésorier et les co-gestionnaires peuvent changer l’ordre.",
  },
  {
    id: "co-gestionnaire",
    titre: "Nommer un co-gestionnaire",
    questions: ["nommer un co-gestionnaire", "ajouter un adjoint", "donner des droits à un membre", "deuxième responsable"],
    etapes: [
      "Ouvrez le groupe, touchez « Réglages ».",
      "Dans la liste des membres, touchez « Nommer co-gestionnaire » sous la personne choisie.",
    ],
    note: "Le co-gestionnaire peut gérer les membres et l’ordre des tours. Seul le trésorier confirme les paiements et verse l’argent.",
  },
  {
    id: "retirer-membre",
    titre: "Retirer un membre (trésorier)",
    questions: ["retirer un membre", "enlever quelqu’un du groupe", "supprimer un membre", "exclure un membre"],
    etapes: [
      "Ouvrez le groupe, touchez « Réglages ».",
      "Dans la liste des membres, touchez « Retirer » sous la personne, puis confirmez.",
    ],
    note: "C’est le trésorier qui le fait lui-même ; Cotiz IA ne peut retirer personne. Les paiements déjà enregistrés restent dans l’historique.",
  },
  {
    id: "code-oublie",
    titre: "Code secret oublié",
    questions: ["j’ai oublié mon code", "code oublié", "mot de passe oublié", "je n’arrive pas à entrer mon code", "réinitialiser mon code"],
    etapes: [
      "Sur l’écran du code, touchez « Code oublié ? ».",
      "Écrivez votre nom et votre date de naissance (ceux de votre inscription).",
      "Si c’est juste, créez tout de suite un nouveau code à 4 chiffres.",
    ],
    note: "Si ça ne marche pas, un conseiller peut vous aider ici.",
  },
  {
    id: "changer-code",
    titre: "Changer son code secret ou activer l’empreinte",
    questions: ["changer mon code", "modifier mon code secret", "activer l’empreinte", "entrer avec le doigt", "empreinte digitale"],
    etapes: [
      "Allez dans « Profil » → « Sécurité ».",
      "Touchez « Changer mon code secret », ou « Activer l’empreinte ».",
    ],
    note: "Sur l’écran du code, vous pouvez aussi toucher le bouton empreinte en bas à gauche du clavier.",
  },
  {
    id: "recu",
    titre: "Voir son reçu et l’historique",
    questions: ["où voir mon reçu", "reçu de paiement", "historique des paiements", "preuve de paiement", "voir qui a payé"],
    etapes: [
      "Ouvrez le groupe, touchez « Historique ».",
      "Touchez un paiement pour ouvrir son reçu (vous pouvez le partager).",
    ],
  },
  {
    id: "quitter-supprimer",
    titre: "Quitter un groupe ou supprimer son compte",
    questions: ["quitter le groupe", "sortir du groupe", "supprimer mon compte", "fermer mon compte", "supprimer le groupe"],
    etapes: [
      "Pour supprimer votre compte : Profil → « Supprimer mon compte », puis suivez les étapes.",
      "Pour supprimer un groupe (trésorier) : groupe → Réglages → « Supprimer le groupe » tout en bas.",
      "Pour quitter un groupe : demandez au trésorier de vous retirer, ou utilisez le bouton prévu dans le groupe s’il est affiché.",
    ],
    note: "Cotiz IA ne supprime rien elle-même : c’est toujours vous (ou le trésorier) qui décidez et qui le faites.",
  },
  {
    id: "installer",
    titre: "Installer Cotiz",
    questions: ["installer l’application", "télécharger cotiz", "application android", "installer sur iphone", "play store"],
    etapes: [
      "Android : Profil → « Télécharger l’application Android », ou cherchez Cotiz sur le Play Store.",
      "iPhone : ouvrez tontine-et-cotise.vercel.app dans Safari, touchez Partager (carré avec une flèche), puis « Sur l’écran d’accueil ».",
    ],
  },
  {
    id: "notifications",
    titre: "Notifications",
    questions: ["notifications", "je ne reçois pas les alertes", "la cloche", "être prévenu des paiements"],
    etapes: [
      "Touchez la cloche en haut de l’écran pour voir vos notifications (paiements, demandes, versements).",
      "Si votre téléphone le propose, autorisez les notifications de Cotiz dans les réglages du téléphone.",
    ],
  },
];

/** Texte prêt à envoyer : titre + étapes numérotées + note */
export function texteGuide(g: Guide): string {
  return [`${g.titre} :`, ...g.etapes.map((e, i) => `${i + 1}. ${e}`), ...(g.note ? ["", g.note] : [])].join("\n");
}
