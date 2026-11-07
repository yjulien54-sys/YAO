export type GroupType = "tontine" | "association" | "collecte";
export type Frequency = "hebdomadaire" | "mensuelle" | "unique";
export type PayMethod = "wave" | "orange" | "mtn" | "moov" | "especes";
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
  role: "tresorier" | "membre";
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
  payouts: Payout[];
  createdAt: string;
}
