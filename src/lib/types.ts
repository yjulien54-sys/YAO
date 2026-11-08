export type GroupType = "tontine" | "association" | "collecte";
export type Frequency = "quotidienne" | "3jours" | "hebdomadaire" | "2semaines" | "mensuelle" | "trimestrielle" | "semestrielle" | "annuelle" | "unique";
export type PayMethod = "wave" | "orange" | "mtn" | "moov" | "especes";
export interface Engagement {
  profileId: string;
  nom: string;
  telephone: string;
  texte: string;
  acceptedAt: string;
}

export type AddPolicy = "tresorier" | "gestionnaires" | "tous";
export type MemberStatus = "paye" | "attente" | "retard";

export interface User {
  name: string;
  phone: string;
}

export interface Member {
  id: string;
  profileId?: string | null;
  name: string;
  phone: string;
  role: "tresorier" | "gestionnaire" | "membre";
}

export interface Payment {
  id: string;
  memberId: string;
  amount: number; // cotisation
  penalty: number; // pénalité de retard incluse
  method: PayMethod;
  round: number;
  date: string; // ISO
  reference: string;
  fees: number; // frais Mobile Money (pris sur la caisse)
  transactionId?: string; // référence de transaction (opérateur ou déclaration)
  status: "en_attente" | "reussi" | "echoue";
}

export type PayoutMethod = PayMethod | "virement" | "cinetpay";

export interface Payout {
  id: string;
  round: number;
  memberId?: string | null;
  beneficiaryName: string;
  amount: number;
  method: PayoutMethod;
  status: "en_cours" | "verse" | "echoue";
  note?: string;
  reference: string;
  date: string;
}

export interface Group {
  id: string;
  name: string;
  type: GroupType;
  description?: string;
  amount: number; // cotisation par membre et par tour (0 pour une collecte libre)
  frequency: Frequency;
  startDate: string; // échéance du 1er tour (ISO)
  penalty: number; // pénalité fixe en cas de retard
  target?: number; // objectif (collecte)
  members: Member[];
  order: string[]; // ordre de passage (tontine)
  currentRound: number;
  payments: Payment[]; // paiements réussis uniquement
  pending: Payment[]; // paiements déclarés, en attente de confirmation du trésorier
  payouts: Payout[];
  paymentPhone?: string; // numéro Wave qui reçoit les cotisations
  waveLink?: string; // lien de paiement Wave Business (montant pré-rempli)
  addPolicy: AddPolicy; // qui peut ajouter des membres
  createdBy?: string;
  tiragePrevu?: string; // date prévue du tirage au sort (ISO)
  tirageFait?: string; // date à laquelle le tirage a été fait (ISO)
  tiragePar?: string; // nom de la personne qui a lancé le tirage
  engagements: Engagement[]; // règlements acceptés
  createdAt: string;
}
