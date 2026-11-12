"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Jauge, Montre, Anneau, Pyramide, Courbe, Colonnes, TexteAnime, VERT, ORANGE, VIOLET } from "@/components/admin/Graphiques";
import { DateNaissance } from "@/components/DateNaissance";
import {
  Ban, BarChart3, BadgeCheck, Coins, CalendarDays, Camera, CheckCircle2, ChevronDown, ChevronLeft, Contact, Download, ExternalLink, FolderOpen, Headset, IdCard, MessageSquareText, Phone, ScrollText, Send, ShieldX, UserCog, ChevronRight, Clock, Copy, Eye, EyeOff, KeyRound, LayoutDashboard, Lock, LogOut, Mail, Megaphone, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, Users, UsersRound, Wallet, X,
} from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { TRANCHES_DEFAUT, fraisPour, lirePourcent, lireTranches, lireTranchesPenalite, partCotizPenalite, type Tranche, type TranchePenalite } from "@/lib/fraisService";
import { dateCourte, fcfa, telAffiche } from "@/lib/format";

type Stats = {
  inscrits: number; inscrits_7j: number; groupes: number; membres: number;
  paiements_confirmes: number; paiements_attente: number; montant_confirme: number; montant_attente: number;
  codes_definis: number; demandes_code_7j: number;
};
type Inscrit = { id: string; nom: string; telephone: string; naissance: string | null; inscrit_le: string; nb_groupes: number; code_defini: boolean };
type Groupe = { id: string; nom: string; type: string; montant: number; frequence: string; tour: number; cree_le: string; nb_membres: number; tresorier: string | null; tresorier_tel: string | null; collecte: number; en_attente: number };
type Attente = { id: string; le: string; groupe: string; membre: string; montant: number; moyen: string; tresorier_tel: string | null; encaisse_cotiz?: boolean; reference?: string | null; membre_tel?: string | null };
type Demande = { le: string; nom: string | null; telephone: string | null; nom_saisi: string | null; naissance_saisie: string | null; resultat: string };
type MembreA = { membre_id: string; profile_id: string | null; nom: string; telephone: string; role: string; bloque: boolean; groupe_id: string; groupe: string; type: string; montant: number; tour: number; statut: "a_jour" | "pas_paye" | "en_attente" | "demande"; paye_tour: number; total_paye: number; nb_attente: number };
type VersementA = { id: string; le: string; groupe_id: string; groupe: string; beneficiaire: string; montant: number; moyen: string; tour: number; requis: number; validations: number; demande_par: string | null };
type LigneJournal = { id: number; le: string; admin_email: string | null; action: string; cible: string | null; detail: string | null };
type Dossier = { id: string; numero: number; cree_le: string; cree_par: string; motif: string; priorite: "normale" | "urgente"; client_profile_id: string | null; client_nom: string | null; client_tel: string | null; groupe_id: string | null; groupe_nom: string | null; montant: number | null; reference: string | null; description: string; donnees: Record<string, string>; statut: "ouvert" | "valide" | "refuse"; reponse: string | null; traite_par: string | null; traite_le: string | null };
type DossierInit = { motif?: string; client_profile_id?: string | null; client_nom?: string | null; client_tel?: string | null; groupe_id?: string | null; groupe_nom?: string | null; montant?: number | null; reference?: string | null; donnees?: Record<string, string>; resume?: string };
type Membre_Equipe = { email: string; nom: string | null; role: "fondateur" | "agent"; ajoute_le: string; numero: number | null; fonctions?: string[]; telephone: string | null; photo_path: string | null; cni_numero: string | null; cni_path: string | null; salaire: number | null; cnps_declare: boolean; cnps_numero: string | null; cnps_le: string | null; embauche_le: string | null; contrat: string | null; contact_urgence: string | null; note: string | null };
type Requete = { id: string; numero: number; cree_le: string; profile_id: string; nom: string | null; telephone: string | null; motif: string; message: string; statut: "nouvelle" | "en_cours" | "resolue"; agent_email: string | null; reponse: string | null; maj_le: string };
type Creneau = { id: string; email: string; nom: string | null; numero: number | null; fonctions?: string[]; jour: string; debut: string; fin: string; note: string | null };
type Salaire = { email: string; nom: string | null; numero: number | null; telephone: string | null; salaire: number | null; cnps_declare: boolean; paye: boolean; montant_paye: number | null; paye_le: string | null; reference: string | null };
/** Fonctions (postes) qu'on trouve dans l'entreprise, à cocher pour chaque membre de l'équipe */
const FONCTIONS: { groupe: string; postes: string[] }[] = [
  { groupe: "Service client", postes: ["Agent du service client", "Superviseur du service client", "Téléconseiller(e)"] },
  { groupe: "Paiements et finances", postes: ["Vérification des paiements", "Chargé(e) de recouvrement", "Comptable", "Caissier(ère)"] },
  { groupe: "Commercial et communication", postes: ["Commercial(e)", "Chargé(e) de partenariats", "Chargé(e) de communication", "Community manager"] },
  { groupe: "Direction et administration", postes: ["Directeur(trice) général(e)", "Responsable des opérations", "Assistant(e) administratif(ve)", "Ressources humaines", "Juriste / conformité"] },
  { groupe: "Technique et terrain", postes: ["Informatique / développeur", "Agent de terrain", "Formateur(trice)", "Stagiaire"] },
];

/** Liste déroulante des fonctions : on clique, on cherche, on coche */
function ChoixFonctions({ valeur, onChange }: { valeur: string[]; onChange: (v: string[]) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", fermer);
    return () => document.removeEventListener("mousedown", fermer);
  }, [ouvert]);
  const basculer = (x: string) => onChange(valeur.includes(x) ? valeur.filter((y) => y !== x) : [...valeur, x]);
  const groupes = FONCTIONS.map((g) => ({ ...g, postes: g.postes.filter((x) => !q || norm(x).includes(norm(q))) })).filter((g) => g.postes.length);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert}
        className={`${champ} flex items-center justify-between gap-2 text-left`}>
        <span className={`min-w-0 truncate ${valeur.length ? "text-stone-900" : "text-stone-400"}`}>{valeur.length ? valeur.join(", ") : "Choisir la ou les fonctions…"}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {valeur.length > 0 && <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[0.7rem] font-bold text-white">{valeur.length}</span>}
          <ChevronDown size={16} className={`text-stone-400 transition ${ouvert ? "rotate-180" : ""}`} />
        </span>
      </button>
      {ouvert && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl">
          <div className="border-b border-stone-100 p-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher une fonction…" className="w-full rounded-lg bg-stone-50 py-2 pl-8 pr-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-sky-100" />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {groupes.length === 0 && <p className="px-3 py-3 text-sm text-stone-500">Aucune fonction trouvée.</p>}
            {groupes.map((g) => (
              <div key={g.groupe}>
                <p className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-stone-400">{g.groupe}</p>
                {g.postes.map((x) => {
                  const coche = valeur.includes(x);
                  return (
                    <label key={x} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm hover:bg-sky-50">
                      <input type="checkbox" checked={coche} onChange={() => basculer(x)} className="h-4 w-4 accent-sky-600" />
                      <span className={coche ? "font-semibold text-sky-800" : "text-stone-700"}>{x}</span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-stone-100 px-3 py-2">
            <button type="button" onClick={() => onChange([])} className="text-xs font-semibold text-stone-500 hover:text-stone-700">Tout décocher</button>
            <button type="button" onClick={() => setOuvert(false)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Identifiant de connexion d'un agent : son numéro (27xx) */
const emailAgent = (n: string | number) => `agent${n}@tontine-et-cotise.vercel.app`;
/** Rôle de la personne connectée + ouverture du formulaire « dossier » */
const AdminCtx = createContext<{ fondateur: boolean; demander: (d: DossierInit) => void }>({ fondateur: true, demander: () => {} });
const MOTIFS = [
  "Confirmer un paiement", "Refuser un paiement", "Valider un versement", "Refuser un versement",
  "Modifier nom / numéro / date de naissance", "Bloquer un compte", "Débloquer un compte",
  "Accepter un membre", "Retirer un membre", "Changer un rôle", "Supprimer un groupe", "Supprimer un compte",
  "Litige / remboursement", "Réclamation d’un client", "Problème technique", "Autre",
];
type Annonce = { id: string; titre: string; texte: string | null; lien: string | null; bouton: string | null; couleur: string; actif: boolean; ordre: number; video?: string | null };
/** Vidéos pub disponibles sur le site (dossier public/pub) */
const VIDEOS_PUB = [
  ["/pub/Cotiz-bandeau-1-transparence-voix.mp4", "Pub 1 · Fini les palabres (voix)"],
  ["/pub/Cotiz-bandeau-2-payer-en-1-clic-voix.mp4", "Pub 2 · Payer en 1 clic (voix)"],
  ["/pub/Cotiz-bandeau-3-tresoriers-voix.mp4", "Pub 3 · Pour les trésoriers (voix)"],
  ["/pub/Cotiz-bandeau-1-transparence-musique.mp4", "Pub 1 · Fini les palabres (musique)"],
  ["/pub/Cotiz-bandeau-2-payer-en-1-clic-musique.mp4", "Pub 2 · Payer en 1 clic (musique)"],
  ["/pub/Cotiz-bandeau-3-tresoriers-musique.mp4", "Pub 3 · Pour les trésoriers (musique)"],
] as const;

const ONGLETS = [
  { id: "requetes", label: "Requêtes clients", icon: MessageSquareText, ton: "sky" },
  { id: "apercu", label: "Vue d’ensemble", icon: LayoutDashboard, ton: "emerald" },
  { id: "stats", label: "Statistiques", icon: BarChart3, ton: "teal" },
  { id: "inscrits", label: "Inscrits", icon: Users, ton: "sky" },
  { id: "groupes", label: "Groupes", icon: UsersRound, ton: "violet" },
  { id: "membres", label: "Membres par groupe", icon: Contact, ton: "teal" },
  { id: "paiements", label: "À valider", icon: Clock, ton: "amber" },
  { id: "codes", label: "Codes oubliés", icon: KeyRound, ton: "rose" },
  { id: "annonces", label: "Annonces", icon: Megaphone, ton: "orange" },
  { id: "dossiers", label: "Dossiers", icon: FolderOpen, ton: "violet" },
  { id: "journal", label: "Journal admin", icon: ScrollText, ton: "emerald" },
  { id: "planning", label: "Planning", icon: CalendarDays, ton: "teal" },
  { id: "equipe", label: "Équipe", icon: UserCog, ton: "sky" },
  { id: "salaires", label: "Salaires", icon: Wallet, ton: "emerald" },
  { id: "revenus", label: "Mes revenus", icon: Coins, ton: "amber" },
] as const;
type Onglet = (typeof ONGLETS)[number]["id"];
const RESERVE_FONDATEUR: Onglet[] = ["annonces", "journal", "equipe", "salaires", "revenus"];
type Ton = (typeof ONGLETS)[number]["ton"] | "red";

/** Couleurs par rubrique (pastille d'icône, carte chiffrée) */
const TON: Record<Ton, { pastille: string; carte: string; texte: string; barre: string }> = {
  emerald: { pastille: "bg-emerald-600 text-white", carte: "from-emerald-50 to-white border-emerald-100", texte: "text-emerald-700", barre: "bg-emerald-500" },
  teal: { pastille: "bg-teal-100 text-teal-700", carte: "from-teal-50 to-white border-teal-100", texte: "text-teal-700", barre: "bg-teal-500" },
  sky: { pastille: "bg-emerald-800 text-white", carte: "from-emerald-50 to-white border-emerald-100", texte: "text-emerald-800", barre: "bg-emerald-800" },
  violet: { pastille: "bg-orange-500 text-white", carte: "from-orange-50 to-white border-orange-100", texte: "text-orange-700", barre: "bg-orange-500" },
  amber: { pastille: "bg-orange-100 text-orange-700", carte: "from-orange-50 to-white border-orange-100", texte: "text-orange-700", barre: "bg-amber-500" },
  rose: { pastille: "bg-rose-100 text-rose-700", carte: "from-rose-50 to-white border-rose-100", texte: "text-rose-700", barre: "bg-rose-500" },
  orange: { pastille: "bg-orange-100 text-orange-700", carte: "from-orange-50 to-white border-orange-100", texte: "text-orange-700", barre: "bg-orange-500" },
  red: { pastille: "bg-red-100 text-red-700", carte: "from-red-50 to-white border-red-100", texte: "text-red-700", barre: "bg-red-500" },
};

const RESULTAT: Record<string, [string, string]> = {
  reussie: ["Réussie", "bg-emerald-50 text-emerald-700"],
  echouee: ["Échouée", "bg-red-50 text-red-700"],
  bloquee: ["Bloquée", "bg-stone-200 text-stone-700"],
  sans_naissance: ["Sans date de naissance", "bg-amber-50 text-amber-800"],
};
const STATUT_MEMBRE: Record<MembreA["statut"], [string, string]> = {
  a_jour: ["À jour", "bg-emerald-50 text-emerald-700 ring-emerald-100"],
  pas_paye: ["Pas encore payé", "bg-red-50 text-red-700 ring-red-100"],
  en_attente: ["Paiement en attente", "bg-amber-50 text-amber-800 ring-amber-100"],
  demande: ["Veut rejoindre", "bg-sky-50 text-sky-700 ring-sky-100"],
};
const TYPE: Record<string, string> = { tontine: "Tontine", association: "Association", collecte: "Collecte" };
/** Couleur fixe par type de groupe (palette vérifiée daltonisme) */
const TYPE_COULEUR: Record<string, string> = { tontine: VERT, association: ORANGE, collecte: VIOLET };
const champ = "w-full rounded-xl border border-stone-300/80 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function Admin() {
  const [pret, setPret] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [autorise, setAutorise] = useState<boolean | null>(null);
  const [role, setRole] = useState<"fondateur" | "agent">("fondateur");

  useEffect(() => {
    db.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setPret(true);
    });
    const { data } = db.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!email) return setAutorise(null);
    db.rpc("is_admin").then(async ({ data, error }) => {
      // Rôle (mise à jour SQL n°17) : sans elle, tout administrateur est fondateur
      const r = await db.rpc("mon_role_admin");
      setRole(!r.error && r.data === "agent" ? "agent" : "fondateur");
      setAutorise(!error && data === true);
    });
  }, [email]);

  if (!pret) return <Attente_ texte="Chargement…" />;
  if (!email) return <Connexion />;
  if (autorise === null) return <Attente_ texte="Vérification de l’accès…" />;
  if (!autorise)
    return (
      <FondVert>
        <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-2xl shadow-emerald-950/30">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600"><ShieldAlert size={30} /></span>
          <p className="mt-4 text-xl font-extrabold">Accès refusé</p>
          <p className="mt-2 text-sm text-stone-600">Le compte <b>{email}</b> n’est pas administrateur. Ajoute cet e-mail dans la table <code>admins</code> de Supabase.</p>
          <button onClick={() => db.auth.signOut()} className="mt-5 rounded-xl bg-stone-900 px-5 py-3 text-sm font-bold text-white">Se déconnecter</button>
        </div>
      </FondVert>
    );
  return <TableauDeBord email={email} role={role} />;
}

function Attente_({ texte }: { texte: string }) {
  return (
    <FondVert>
      <div className="text-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/logo.svg" alt="" width={64} height={64} className="mx-auto h-16 w-16 animate-pulse rounded-2xl shadow-xl" />
        <p className="mt-4 text-sm font-medium text-emerald-50/90">{texte}</p>
      </div>
    </FondVert>
  );
}

/** Fond vert Cotiz avec motif et bande kente */
function FondVert({ children }: { children: React.ReactNode }) {
  return (
    <div className="zone-admin degrade-vert relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <div className="motif pointer-events-none absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-emerald-300/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
      <div className="relative w-full">{children}</div>
    </div>
  );
}

function Connexion() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  async function connecter(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setOccupe(true);
    // Un agent se connecte avec son numéro (ex : 2704)
    const id = email.trim();
    const { error } = await db.auth.signInWithPassword({ email: /^27\d{2,3}$/.test(id) ? emailAgent(id) : id, password: mdp });
    setOccupe(false);
    if (error) setErreur(error.message.includes("Invalid") ? "E-mail ou mot de passe incorrect." : error.message);
  }

  return (
    <FondVert>
      <div className="mx-auto grid w-full max-w-5xl items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
        {/* Présentation (ordinateur) */}
        <div className="hidden text-white lg:block">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-2xl shadow-lg" />
            <p className="text-3xl font-extrabold tracking-tight">Cotiz</p>
          </div>
          <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight">Le poste de pilotage<br />de ta plateforme.</h1>
          <p className="mt-4 max-w-md text-base text-emerald-50/85">Suis les inscriptions, les groupes et l’argent qui circule. Aide les membres, règle les problèmes, protège la communauté.</p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              [Users, "Tous les inscrits, leurs groupes et leurs fiches"],
              [Wallet, "Les paiements confirmés et en attente"],
              [ShieldCheck, "Blocage des fraudeurs et codes oubliés"],
            ].map(([I, t], i) => {
              const Icone = I as typeof Users;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20"><Icone size={18} /></span>
                  <span className="text-emerald-50">{t as string}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Formulaire */}
        <form onSubmit={connecter} className="mx-auto w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl shadow-emerald-950/40">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={64} height={64} className="mx-auto h-16 w-16 rounded-2xl shadow-md shadow-emerald-900/20" />
            <p className="mt-4 text-[1.4rem] font-extrabold leading-tight tracking-tight">Espace administrateur</p>
            <p className="mt-1 text-sm text-stone-500">Fondateur : ton e-mail · Agent : ton numéro (27…)</p>
          </div>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">E-mail ou numéro d’agent</span>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoCapitalize="none" placeholder="ton@email.com ou 2704" className={`${champ} !py-3 pl-11`} required />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">Mot de passe</span>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" placeholder="••••••••" className={`${champ} !py-3 pl-11 pr-11`} required />
                <button type="button" onClick={() => setVoir(!voir)} className="absolute inset-y-0 right-3 grid place-items-center text-stone-400 hover:text-stone-600" aria-label={voir ? "Cacher le mot de passe" : "Afficher le mot de passe"}>
                  {voir ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          </div>
          {erreur && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{erreur}</p>}
          <button disabled={occupe} className="mt-6 w-full rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-700/30 transition hover:brightness-110 disabled:opacity-60">
            {occupe ? "Connexion…" : "Se connecter"}
          </button>
          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-stone-500"><Lock size={13} /> Connexion sécurisée · accès réservé à l’équipe Cotiz</p>
        </form>
      </div>
    </FondVert>
  );
}

function TableauDeBord({ email, role }: { email: string; role: "fondateur" | "agent" }) {
  const fondateur = role === "fondateur";
  const [onglet, setOnglet] = useState<Onglet>(role === "agent" ? "requetes" : "apercu");
  const [stats, setStats] = useState<Stats | null>(null);
  const [inscrits, setInscrits] = useState<Inscrit[]>([]);
  const [groupes, setGroupes] = useState<Groupe[]>([]);
  const [attente, setAttente] = useState<Attente[]>([]);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [annonces, setAnnonces] = useState<Annonce[]>([]);
  const [membres, setMembres] = useState<MembreA[] | null>(null); // null : mise à jour SQL n°16 pas encore faite
  const [versements, setVersements] = useState<VersementA[]>([]);
  const [journal, setJournal] = useState<LigneJournal[] | null>(null);
  const [typeMembres, setTypeMembres] = useState<string>("tous");
  const [dossiers, setDossiers] = useState<Dossier[] | null>(null); // null : mise à jour SQL n°17 pas encore faite
  const [equipe, setEquipe] = useState<Membre_Equipe[]>([]);
  const [formDossier, setFormDossier] = useState<DossierInit | null>(null);
  const [requetes, setRequetes] = useState<Requete[] | null>(null); // null : mise à jour SQL n°18 pas encore faite
  const [maFiche, setMaFiche] = useState<{ nom: string | null; numero: number | null; fonctions?: string[] } | null>(null);
  const [motDePasse, setMotDePasse] = useState(false);
  const [charge, setCharge] = useState(false);
  const [maj, setMaj] = useState<Date | null>(null);
  const [msg, setMsg] = useState("");
  const [fiche, setFiche] = useState<{ type: "utilisateur" | "groupe"; id: string } | null>(null);

  const charger = useCallback(async () => {
    setCharge(true);
    const [s, i, g, a, d, an] = await Promise.all([
      db.rpc("admin_stats"),
      db.rpc("admin_inscrits"),
      db.rpc("admin_groupes"),
      db.rpc("admin_paiements_attente"),
      db.rpc("admin_demandes_code"),
      db.from("annonces").select("id, titre, texte, lien, bouton, couleur, actif, ordre, video").order("ordre")
        .then((r) => (r.error ? db.from("annonces").select("id, titre, texte, lien, bouton, couleur, actif, ordre").order("ordre") : r)),
    ]);
    setStats((s.data as Stats) ?? null);
    setInscrits((i.data as Inscrit[]) ?? []);
    setGroupes((g.data as Groupe[]) ?? []);
    setAttente((a.data as Attente[]) ?? []);
    setDemandes((d.data as Demande[]) ?? []);
    setAnnonces((an.data as Annonce[]) ?? []);
    // Mise à jour SQL n°16 (facultative tant qu'elle n'est pas faite)
    const [mb, vs, jn, ds, eq] = await Promise.all([db.rpc("admin_membres"), db.rpc("admin_versements_attente"), db.rpc("admin_journal"), db.rpc("admin_dossiers"), db.rpc("admin_equipe")]);
    setDossiers(ds.error ? null : ((ds.data as Dossier[]) ?? []));
    const [rq, mf] = await Promise.all([db.rpc("admin_requetes"), db.rpc("ma_fiche_admin")]);
    setRequetes(rq.error ? null : ((rq.data as Requete[]) ?? []));
    setMaFiche(mf.error ? null : (mf.data as { nom: string | null; numero: number | null; fonctions?: string[] }));
    setEquipe(eq.error ? [] : ((eq.data as Membre_Equipe[]) ?? []));
    setMembres(mb.error ? null : ((mb.data as MembreA[]) ?? []));
    setVersements(vs.error ? [] : ((vs.data as VersementA[]) ?? []));
    setJournal(jn.error ? null : ((jn.data as LigneJournal[]) ?? []));
    const err = [s, i, g, a, d, an].find((r) => r.error)?.error;
    setMsg(err ? "Erreur : " + err.message : "");
    setMaj(new Date());
    setCharge(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const aValider = attente.length + versements.length;
  const ouverts = (dossiers ?? []).filter((d) => d.statut === "ouvert").length;
  const nouvelles = (requetes ?? []).filter((r) => r.statut === "nouvelle").length;
  const compteurs: Partial<Record<Onglet, number>> = { inscrits: inscrits.length, groupes: groupes.length, membres: membres?.length, paiements: aValider, codes: demandes.length, annonces: annonces.length, dossiers: dossiers ? ouverts : undefined, equipe: equipe.length || undefined, requetes: requetes ? nouvelles : undefined };
  const alerte: Partial<Record<Onglet, boolean>> = { paiements: aValider > 0, dossiers: fondateur && ouverts > 0, requetes: nouvelles > 0 };
  const onglets = ONGLETS.filter((o) => fondateur || !RESERVE_FONDATEUR.includes(o.id));
  const voirMembres = (t: string) => { setTypeMembres(t); setOnglet("membres"); };
  const courant = onglets.find((o) => o.id === onglet) ?? onglets[0];
  const heure = new Date().getHours();
  const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <AdminCtx.Provider value={{ fondateur, demander: (d) => setFormDossier(d) }}>
    <div className="zone-admin min-h-dvh bg-[#f4f2ec] text-stone-900 lg:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="degrade-vert relative hidden w-[260px] shrink-0 overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="motif pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex items-center gap-3 px-5 pb-4 pt-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl shadow-md" />
          <div>
            <p className="text-lg font-extrabold leading-tight">Cotiz</p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-emerald-100/80">Administration</p>
          </div>
        </div>
        <nav className="relative min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3">
          {onglets.map(({ id, label, icon: I }) => {
            const actif = onglet === id;
            return (
              <button key={id} onClick={() => setOnglet(id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${actif ? "bg-white text-emerald-900 shadow-lg shadow-emerald-950/20" : "text-emerald-50/90 hover:bg-white/10"}`}>
                <I size={18} strokeWidth={2} className={actif ? "text-emerald-700" : ""} />
                <span className="flex-1">{label}</span>
                {compteurs[id] !== undefined && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${alerte[id] ? "bg-orange-500 text-white" : actif ? "bg-emerald-100 text-emerald-800" : "bg-white/15"}`}>{compteurs[id]}</span>
                )}
              </button>
            );
          })}
        </nav>
        <a href="/groupes" target="_blank" rel="noopener" className="relative mx-3 mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-emerald-50/90 hover:bg-white/10">
          <ExternalLink size={17} /> Ouvrir l’application
        </a>
        <div className="relative m-3 rounded-2xl bg-white/10 p-3 ring-1 ring-white/15">
          <p className="mb-1 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide">{fondateur ? "Fondateur" : "Agent service client"}{maFiche?.numero ? ` · n°${maFiche.numero}` : ""}</p>
          {maFiche?.nom && <p className="truncate text-sm font-bold">{maFiche.nom}</p>}
          {!!maFiche?.fonctions?.length && <p className="truncate text-[0.7rem] text-emerald-100">{maFiche.fonctions.join(" · ")}</p>}
          <p className="truncate text-xs text-emerald-50/80">Connecté : <b className="text-white">{email}</b></p>
          <button onClick={() => setMotDePasse(true)} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/10 py-2 text-xs font-bold hover:bg-white/20">
            <Lock size={14} /> Changer mon mot de passe
          </button>
          <button onClick={() => db.auth.signOut()} className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2 text-xs font-bold hover:bg-white/25">
            <LogOut size={14} /> Se déconnecter
          </button>
        </div>
        <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
      </aside>

      <div className="min-w-0 flex-1">
        {/* En-tête (téléphone) */}
        <header className="degrade-vert relative overflow-hidden text-white lg:hidden">
          <div className="motif pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative flex items-center gap-3 px-4 pb-3 pt-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={36} height={36} className="h-9 w-9 rounded-xl shadow" />
            <div className="min-w-0 flex-1">
              <p className="font-extrabold leading-tight">Cotiz · {fondateur ? "Admin" : "Service client"}</p>
              <p className="truncate text-xs text-emerald-50/80">{maFiche?.numero ? `n°${maFiche.numero} · ` : ""}{maFiche?.nom ?? email}</p>
            </div>
            <button onClick={() => setMotDePasse(true)} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Changer mon mot de passe"><Lock size={16} /></button>
            <button onClick={charger} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Actualiser"><RefreshCw size={17} className={charge ? "animate-spin" : ""} /></button>
            <button onClick={() => db.auth.signOut()} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Se déconnecter"><LogOut size={16} /></button>
          </div>
          <nav className="relative flex gap-1.5 overflow-x-auto px-3 pb-3" data-pas-glisser>
            {onglets.map(({ id, label, icon: I }) => (
              <button key={id} onClick={() => setOnglet(id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[0.8rem] font-semibold transition ${onglet === id ? "bg-white text-emerald-900" : "bg-white/10 text-emerald-50"}`}>
                <I size={15} /> {label}
                {compteurs[id] !== undefined && <span className={`rounded-full px-1.5 text-[0.7rem] font-bold ${alerte[id] ? "bg-orange-500 text-white" : onglet === id ? "bg-emerald-100" : "bg-white/15"}`}>{compteurs[id]}</span>}
              </button>
            ))}
          </nav>
          <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
        </header>

        <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 lg:px-8 lg:py-8">
          {/* Titre de la rubrique */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className={`grid h-11 w-11 place-items-center rounded-2xl ${TON[courant.ton].pastille}`}><courant.icon size={22} /></span>
              <div>
                <p className="text-xs font-semibold text-stone-500">{onglet === "apercu" ? `${salut} 👋` : "Administration"}</p>
                <h1 className="text-2xl font-extrabold tracking-tight">{courant.label}</h1>
              </div>
            </div>
            <div className="hidden items-center gap-2 lg:flex">
              {maj && <span className="text-xs text-stone-500">Mis à jour à {maj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>}
              <button onClick={charger} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 shadow-sm hover:bg-stone-50">
                <RefreshCw size={15} className={charge ? "animate-spin" : ""} /> Actualiser
              </button>
            </div>
          </div>

          {msg && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{msg}</p>}
          <div key={onglet} className="cascade space-y-5">
          {onglet === "apercu" && <Apercu stats={stats} inscrits={inscrits} groupes={groupes} attente={attente} demandes={demandes} aller={setOnglet} ouvrir={(type, id) => setFiche({ type, id })} nonDeclares={equipe.filter((a) => a.role === "agent" && !a.cnps_declare).length} nouvelles={nouvelles} />}
          {onglet === "stats" && <Statistiques stats={stats} inscrits={inscrits} groupes={groupes} ouvrir={(id) => setFiche({ type: "groupe", id })} />}
          {onglet === "inscrits" && <Inscrits liste={inscrits} ouvrir={(id) => setFiche({ type: "utilisateur", id })} />}
          {onglet === "groupes" && <Groupes liste={groupes} recharger={charger} ouvrir={(id) => setFiche({ type: "groupe", id })} voirMembres={voirMembres} />}
          {onglet === "membres" && <Membres liste={membres} typeInitial={typeMembres} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} />}
          {onglet === "paiements" && <Paiements liste={attente} versements={versements} recharger={charger} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} />}
          {onglet === "journal" && fondateur && <Journal liste={journal} />}
          {onglet === "dossiers" && <Dossiers liste={dossiers} fondateur={fondateur} recharger={charger} nouveau={() => setFormDossier({})} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} />}
          {onglet === "equipe" && fondateur && <Equipe liste={equipe} moi={email} recharger={charger} />}
          {onglet === "requetes" && <Requetes liste={requetes} moi={email} recharger={charger} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} />}
          {onglet === "planning" && <Planning fondateur={fondateur} equipe={equipe} moi={email} />}
          {onglet === "salaires" && fondateur && <Salaires />}
          {onglet === "revenus" && fondateur && <Revenus />}
          {onglet === "codes" && <Codes liste={demandes} recharger={charger} />}
          {onglet === "annonces" && fondateur && <Annonces liste={annonces} recharger={charger} />}
          </div>
        </main>
      </div>
      {fiche?.type === "utilisateur" && <FicheUtilisateur id={fiche.id} fermer={() => setFiche(null)} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} recharger={charger} />}
      {fiche?.type === "groupe" && <FicheGroupe id={fiche.id} fermer={() => setFiche(null)} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} recharger={charger} />}
      {motDePasse && <ChangerMotDePasse fermer={() => setMotDePasse(false)} />}
      {formDossier && <FormDossier init={formDossier} fermer={() => setFormDossier(null)} envoye={() => { setFormDossier(null); charger(); setOnglet("dossiers"); }} />}
    </div>
    </AdminCtx.Provider>
  );
}

/** Carte chiffrée colorée */
function Chiffre({ label, valeur, detail, icone: I, ton = "emerald", onClick }: { label: string; valeur: string; detail?: string; icone: typeof Users; ton?: Ton; onClick?: () => void }) {
  const t = TON[ton];
  return (
    <button onClick={onClick} disabled={!onClick} className={`carte-vivante group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left shadow-sm ${t.carte}`}>
      <span className="absolute inset-x-0 top-0 flex h-1"><span className="flex-1 bg-orange-500" /><span className="flex-1 bg-white" /><span className="flex-1 bg-emerald-600" /></span>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl shadow-sm transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110 ${t.pastille}`}><I size={20} /></span>
        {onClick && <ChevronRight size={16} className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />}
      </div>
      <p className="mt-3 text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-0.5 truncate text-[1.45rem] font-extrabold tabular-nums leading-tight tracking-tight"><TexteAnime texte={valeur} /></p>
      {detail && <p className={`mt-0.5 text-xs font-medium ${t.texte}`}>{detail}</p>}
    </button>
  );
}

function Bloc({ titre, sous, action, children, className = "" }: { titre: string; sous?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-[0_14px_32px_-16px_rgba(0,82,52,0.25)] lg:p-5 ${className}`}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{titre}</p>
          {sous && <p className="text-xs text-stone-500">{sous}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

/** Inscriptions par jour sur les 30 derniers jours (une seule série) */
function CourbeInscriptions({ inscrits }: { inscrits: Inscrit[] }) {
  const jours = useMemo(() => {
    const parJour = new Map<string, number>();
    for (const i of inscrits) parJour.set(i.inscrit_le.slice(0, 10), (parJour.get(i.inscrit_le.slice(0, 10)) ?? 0) + 1);
    return Array.from({ length: 30 }, (_, k) => {
      const d = new Date(); d.setDate(d.getDate() - (29 - k));
      return { d, n: parJour.get(jour(d)) ?? 0 };
    });
  }, [inscrits]);
  const total = jours.reduce((s, j) => s + j.n, 0);
  return (
    <div>
      <p className="mb-1 text-xs text-stone-500"><b className="text-2xl font-extrabold text-stone-900">{total}</b> inscriptions en 30 jours</p>
      <Courbe points={jours.map((j) => ({ label: j.d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), n: j.n }))} couleur={VERT} format={(n) => `${n} inscrit${n > 1 ? "s" : ""}`} />
    </div>
  );
}

/** Barres horizontales étiquetées */
function Barres({ lignes, format = (n: number) => String(n) }: { lignes: { label: string; n: number; couleur: string; onClick?: () => void }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  return (
    <div className="space-y-2.5">
      {lignes.map((l, i) => (
        <button key={i} type="button" onClick={l.onClick} disabled={!l.onClick} title={`${l.label} : ${format(l.n)}`} className="block w-full text-left enabled:hover:opacity-80">
          <div className="mb-1 flex justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-stone-700">{l.label}</span>
            <span className="shrink-0 font-bold tabular-nums text-stone-900"><TexteAnime texte={format(l.n)} /></span>
          </div>
          <div className="h-3 rounded-full bg-stone-100">
            <div className="etire h-full rounded-full" style={{ width: `${Math.max(2, (l.n / max) * 100)}%`, background: `linear-gradient(90deg, ${l.couleur}aa, ${l.couleur})`, animationDelay: `${i * 0.08}s` }} />
          </div>
        </button>
      ))}
    </div>
  );
}

function Apercu({ stats, inscrits, groupes, attente, demandes, aller, ouvrir, nonDeclares = 0, nouvelles = 0 }: { stats: Stats | null; inscrits: Inscrit[]; groupes: Groupe[]; attente: Attente[]; demandes: Demande[]; aller: (o: Onglet) => void; ouvrir: (type: "utilisateur" | "groupe", id: string) => void; nonDeclares?: number; nouvelles?: number }) {
  if (!stats) return <p className="text-sm text-stone-500">Chargement des chiffres…</p>;
  const bloques = inscrits.filter((i) => i.nom.endsWith("(bloqué)")).length;
  const echecs = demandes.filter((d) => d.resultat === "echouee" || d.resultat === "bloquee").length;
  const derniers = [...inscrits].sort((a, b) => b.inscrit_le.localeCompare(a.inscrit_le)).slice(0, 6);
  const aSurveiller = [
    nouvelles > 0 && { t: `${nouvelles} requête${nouvelles > 1 ? "s" : ""} client sans réponse`, ton: "sky" as Ton, o: "requetes" as Onglet },
    nonDeclares > 0 && { t: `${nonDeclares} agent${nonDeclares > 1 ? "s" : ""} pas encore déclaré${nonDeclares > 1 ? "s" : ""} à la CNPS`, ton: "red" as Ton, o: "equipe" as Onglet },
    attente.length > 0 && { t: `${attente.length} paiement${attente.length > 1 ? "s" : ""} en attente de confirmation`, ton: "amber" as Ton, o: "paiements" as Onglet },
    echecs > 0 && { t: `${echecs} tentative${echecs > 1 ? "s" : ""} « code oublié » échouée${echecs > 1 ? "s" : ""}`, ton: "rose" as Ton, o: "codes" as Onglet },
    bloques > 0 && { t: `${bloques} compte${bloques > 1 ? "s" : ""} bloqué${bloques > 1 ? "s" : ""}`, ton: "red" as Ton, o: "inscrits" as Onglet },
    groupes.some((g) => g.nb_membres <= 1) && { t: `${groupes.filter((g) => g.nb_membres <= 1).length} groupe(s) sans autre membre que le créateur`, ton: "violet" as Ton, o: "groupes" as Onglet },
  ].filter(Boolean) as { t: string; ton: Ton; o: Onglet }[];

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Inscrits" valeur={String(stats.inscrits)} detail={`+${stats.inscrits_7j} cette semaine`} icone={Users} ton="sky" onClick={() => aller("inscrits")} />
        <Chiffre label="Groupes" valeur={String(stats.groupes)} detail={`${stats.membres} membres au total`} icone={UsersRound} ton="violet" onClick={() => aller("groupes")} />
        <Chiffre label="Argent confirmé" valeur={fcfa(stats.montant_confirme)} detail={`${stats.paiements_confirmes} paiements`} icone={Wallet} ton="emerald" onClick={() => aller("stats")} />
        <Chiffre label="En attente" valeur={fcfa(stats.montant_attente)} detail={`${stats.paiements_attente} paiements à confirmer`} icone={Clock} ton="amber" onClick={() => aller("paiements")} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc titre="Inscriptions" sous="Nouveaux comptes, jour par jour" className="lg:col-span-2">
          <CourbeInscriptions inscrits={inscrits} />
        </Bloc>
        <Bloc titre="À surveiller" sous="Ce qui demande ton attention">
          {aSurveiller.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800"><CheckCircle2 size={20} /> Tout est en ordre.</div>
          ) : (
            <div className="space-y-2">
              {aSurveiller.map((a, i) => (
                <button key={i} onClick={() => aller(a.o)} className={`flex w-full items-center gap-2.5 rounded-xl bg-gradient-to-r p-3 text-left text-sm font-semibold ${TON[a.ton].carte} border`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${TON[a.ton].barre}`} />
                  <span className="flex-1">{a.t}</span>
                  <ChevronRight size={15} className="text-stone-400" />
                </button>
              ))}
            </div>
          )}
        </Bloc>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Bloc titre="Paiements confirmés" sous="Part des paiements déjà confirmés">
          <Jauge valeur={stats.paiements_confirmes + stats.paiements_attente ? Math.round((stats.paiements_confirmes / (stats.paiements_confirmes + stats.paiements_attente)) * 100) : 0} label="de taux de confirmation" sous={`${stats.paiements_confirmes} confirmés · ${stats.paiements_attente} en attente`} />
        </Bloc>
        <Bloc titre="Groupes par type">
          <Anneau parts={["tontine", "association", "collecte"].map((t) => ({ label: TYPE[t], n: groupes.filter((g) => g.type === t).length, couleur: TYPE_COULEUR[t] }))} sousCentre="groupes" />
        </Bloc>
        <Bloc titre="Parcours des inscrits" sous="Du compte créé jusqu’au groupe">
          <Pyramide etages={[{ label: "Inscrits", n: stats.inscrits }, { label: "Code secret créé", n: stats.codes_definis }, { label: "Dans un groupe", n: inscrits.filter((i) => i.nb_groupes > 0).length }]} />
        </Bloc>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Derniers inscrits" action={<button onClick={() => aller("inscrits")} className="text-xs font-bold text-sky-700">Tout voir</button>}>
          {derniers.length === 0 ? <p className="text-sm text-stone-500">Personne pour l’instant.</p> : (
            <Liste>
              {derniers.map((i) => (
                <button key={i.id} onClick={() => ouvrir("utilisateur", i.id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-stone-50">
                  <Pastille nom={i.nom} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${i.nom.endsWith("(bloqué)") ? "text-red-600" : ""}`}>{i.nom}</p>
                    <p className="text-xs text-stone-500">{telAffiche(i.telephone)} · {i.nb_groupes} groupe{i.nb_groupes > 1 ? "s" : ""}</p>
                  </div>
                  <span className="shrink-0 text-xs text-stone-400">{dateCourte(i.inscrit_le)}</span>
                </button>
              ))}
            </Liste>
          )}
        </Bloc>
        <Bloc titre="Paiements en attente" sous="Déclarés, pas encore confirmés par le trésorier" action={<button onClick={() => aller("paiements")} className="text-xs font-bold text-amber-700">Tout voir</button>}>
          {attente.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement en attente.</p> : <Liste>{attente.slice(0, 6).map((a) => <LigneAttente key={a.id} a={a} />)}</Liste>}
        </Bloc>
      </div>
    </>
  );
}

function Statistiques({ stats, inscrits, groupes, ouvrir }: { stats: Stats | null; inscrits: Inscrit[]; groupes: Groupe[]; ouvrir: (id: string) => void }) {
  if (!stats) return <p className="text-sm text-stone-500">Chargement des chiffres…</p>;
  const parType = ["tontine", "association", "collecte"].map((t) => ({ t, n: groupes.filter((g) => g.type === t).length, argent: groupes.filter((g) => g.type === t).reduce((s, g) => s + g.collecte, 0) }));
  const top = [...groupes].sort((a, b) => b.collecte - a.collecte).slice(0, 6);
  const avecGroupe = inscrits.filter((i) => i.nb_groupes > 0).length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const moyenne = groupes.length ? Math.round(groupes.reduce((s, g) => s + g.nb_membres, 0) / groupes.length) : 0;
  const tailles = [
    { label: "1 à 5 membres", n: groupes.filter((g) => g.nb_membres <= 5).length },
    { label: "6 à 10 membres", n: groupes.filter((g) => g.nb_membres > 5 && g.nb_membres <= 10).length },
    { label: "11 à 20 membres", n: groupes.filter((g) => g.nb_membres > 10 && g.nb_membres <= 20).length },
    { label: "Plus de 20", n: groupes.filter((g) => g.nb_membres > 20).length },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Bloc titre="Dans un groupe"><Jauge valeur={pct(avecGroupe, inscrits.length)} label="des inscrits" sous={`${avecGroupe} sur ${inscrits.length}`} /></Bloc>
        <Bloc titre="Code secret"><Montre pourcent={pct(stats.codes_definis, stats.inscrits)} label="ont créé leur code" sous={`${stats.codes_definis} sur ${stats.inscrits}`} /></Bloc>
        <Bloc titre="Taille moyenne"><Jauge valeur={moyenne} max={Math.max(20, moyenne)} unite="membres" label="par groupe" format={(n) => `${n}`} /></Bloc>
        <Bloc titre="Paiement moyen"><Jauge valeur={stats.paiements_confirmes ? Math.round(stats.montant_confirme / stats.paiements_confirmes) : 0} max={Math.max(50000, stats.paiements_confirmes ? Math.round(stats.montant_confirme / stats.paiements_confirmes) : 0)} label={`${stats.paiements_confirmes} paiements confirmés`} format={fcfa} /></Bloc>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Groupes par type" sous="Nombre de groupes">
          <Anneau parts={parType.map((p) => ({ label: TYPE[p.t], n: p.n, couleur: TYPE_COULEUR[p.t] }))} sousCentre="groupes" />
        </Bloc>
        <Bloc titre="Argent confirmé par type" sous="Total des cotisations confirmées">
          <Anneau parts={parType.map((p) => ({ label: TYPE[p.t], n: p.argent, couleur: TYPE_COULEUR[p.t] }))} format={fcfa} sousCentre="confirmés" />
        </Bloc>
        <Bloc titre="Groupes qui cotisent le plus" sous="Touche un groupe pour ouvrir sa fiche">
          {top.length === 0 ? <p className="text-sm text-stone-500">Aucun groupe.</p> : <Barres lignes={top.map((g) => ({ label: g.nom, n: g.collecte, couleur: TYPE_COULEUR[g.type] ?? "#059669", onClick: () => ouvrir(g.id) }))} format={fcfa} />}
        </Bloc>
        <Bloc titre="Taille des groupes" sous="Nombre de groupes par nombre de membres">
          <Colonnes lignes={tailles} couleur={VERT} />
        </Bloc>
      </div>
    </>
  );
}

const Liste = ({ children }: { children: React.ReactNode }) => <div className="divide-y divide-stone-100">{children}</div>;

const COULEURS_PASTILLE = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-violet-100 text-violet-800", "bg-amber-100 text-amber-800", "bg-rose-100 text-rose-800", "bg-teal-100 text-teal-800"];
function Pastille({ nom }: { nom: string }) {
  const ini = nom.replace("(bloqué)", "").trim().split(/\s+/).map((m) => m[0]).slice(0, 2).join("").toUpperCase() || "?";
  const c = COULEURS_PASTILLE[[...nom].reduce((s, ch) => s + ch.charCodeAt(0), 0) % COULEURS_PASTILLE.length];
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ${nom.endsWith("(bloqué)") ? "bg-red-100 text-red-700" : c}`}>{ini}</span>;
}

function Puces<T extends string>({ options, valeur, onChange }: { options: { id: T; label: string; n: number }[]; valeur: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1" data-pas-glisser>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${valeur === o.id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600 hover:border-stone-300"}`}>
          {o.label} <span className={valeur === o.id ? "text-white/70" : "text-stone-400"}>{o.n}</span>
        </button>
      ))}
    </div>
  );
}

function Recherche({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${champ} pl-9`} />
    </div>
  );
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");

type FiltreInscrit = "tous" | "semaine" | "sans_groupe" | "sans_code" | "bloques";
function Inscrits({ liste, ouvrir }: { liste: Inscrit[]; ouvrir: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<FiltreInscrit>("tous");
  const semaine = Date.now() - 7 * 86400000;
  const tests: Record<FiltreInscrit, (i: Inscrit) => boolean> = {
    tous: () => true,
    semaine: (i) => new Date(i.inscrit_le).getTime() > semaine,
    sans_groupe: (i) => i.nb_groupes === 0,
    sans_code: (i) => !i.code_defini,
    bloques: (i) => i.nom.endsWith("(bloqué)"),
  };
  const vus = useMemo(() => liste.filter(tests[f]).filter((i) => !q || norm(i.nom).includes(norm(q)) || i.telephone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§")), [liste, q, f]); // eslint-disable-line react-hooks/exhaustive-deps
  const opt = (id: FiltreInscrit, label: string) => ({ id, label, n: liste.filter(tests[id]).length });
  return (
    <Bloc titre={`${vus.length} inscrit${vus.length > 1 ? "s" : ""}`} sous="Touche une personne pour ouvrir sa fiche (modifier, bloquer, réinitialiser le code)">
      <div className="space-y-3">
        <Recherche valeur={q} onChange={setQ} placeholder="Chercher un nom ou un numéro…" />
        <Puces options={[opt("tous", "Tous"), opt("semaine", "Cette semaine"), opt("sans_groupe", "Sans groupe"), opt("sans_code", "Sans code"), opt("bloques", "Bloqués")]} valeur={f} onChange={setF} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="text-left text-[0.7rem] uppercase tracking-wide text-stone-500">
              <tr className="border-b border-stone-200"><th className="py-2">Personne</th><th>Téléphone</th><th>Naissance</th><th>Inscrit le</th><th className="text-right">Groupes</th><th className="text-right">Code</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {vus.map((i) => (
                <tr key={i.id} onClick={() => ouvrir(i.id)} className="cursor-pointer hover:bg-sky-50/60">
                  <td className="py-2.5">
                    <span className="flex items-center gap-2.5">
                      <Pastille nom={i.nom} />
                      <span className={`font-semibold ${i.nom.endsWith("(bloqué)") ? "text-red-600" : "text-stone-900"}`}>{i.nom}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap">{telAffiche(i.telephone)}</td>
                  <td>{i.naissance ? dateCourte(i.naissance) : <span className="text-stone-400">—</span>}</td>
                  <td className="whitespace-nowrap">{dateCourte(i.inscrit_le)}</td>
                  <td className="text-right"><span className={`rounded-md px-2 py-0.5 text-xs font-bold ${i.nb_groupes ? "bg-violet-50 text-violet-700" : "bg-stone-100 text-stone-500"}`}>{i.nb_groupes}</span></td>
                  <td className="text-right">{i.code_defini ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">✓ créé</span> : <span className="text-stone-400">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {vus.length === 0 && <p className="py-4 text-center text-sm text-stone-500">Personne ne correspond.</p>}
        </div>
      </div>
    </Bloc>
  );
}

function Groupes({ liste, recharger, ouvrir, voirMembres }: { liste: Groupe[]; recharger: () => void; ouvrir: (id: string) => void; voirMembres: (type: string) => void }) {
  const { fondateur } = useContext(AdminCtx);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<"tous" | "tontine" | "association" | "collecte" | "attente">("tous");
  const vus = liste
    .filter((g) => type === "tous" || (type === "attente" ? g.en_attente > 0 : g.type === type))
    .filter((g) => !q || norm(g.nom).includes(norm(q)) || norm(g.tresorier).includes(norm(q)));
  const supprimer = async (g: Groupe) => {
    if (!confirm(`Supprimer définitivement « ${g.nom} » ? Ses membres, paiements et versements seront effacés pour tout le monde.`)) return;
    const { error } = await db.rpc("admin_supprimer_groupe", { g: g.id });
    setMsg(error ? "Erreur : " + error.message : `« ${g.nom} » supprimé.`);
    recharger();
  };
  const toutSupprimer = async () => {
    const saisie = prompt(`Tu vas supprimer les ${liste.length} groupes de la plateforme, avec tous leurs paiements. Les comptes des inscrits sont gardés.\n\nPour confirmer, écris : SUPPRIMER TOUT`);
    if (saisie === null) return;
    if (saisie.trim() !== "SUPPRIMER TOUT") return setMsg("Confirmation incorrecte : rien n’a été supprimé.");
    const { data, error } = await db.rpc("admin_supprimer_tous_groupes", { confirmation: "SUPPRIMER TOUT" });
    setMsg(error ? "Erreur : " + error.message : `${data} groupe(s) supprimé(s).`);
    recharger();
  };
  return (
    <section className="space-y-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1"><Recherche valeur={q} onChange={setQ} placeholder="Chercher un groupe ou un trésorier…" /></div>
        {fondateur && liste.length > 0 && (
          <button onClick={toutSupprimer} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">
            <Trash2 size={16} /> Supprimer tous les groupes
          </button>
        )}
      </div>
      <Puces
        options={[
          { id: "tous", label: "Tous", n: liste.length },
          ...(["tontine", "association", "collecte"] as const).map((t) => ({ id: t, label: TYPE[t] + "s", n: liste.filter((g) => g.type === t).length })),
          { id: "attente", label: "Paiements à confirmer", n: liste.filter((g) => g.en_attente > 0).length },
        ]}
        valeur={type}
        onChange={setType}
      />
      <button onClick={() => voirMembres(type === "attente" ? "tous" : type)} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 ring-1 ring-teal-100 hover:bg-teal-100">
        <Contact size={16} /> Voir tous les membres {type === "tous" || type === "attente" ? "" : `des ${TYPE[type].toLowerCase()}s`}, groupe par groupe
      </button>
      {msg && <p className="text-sm font-medium text-emerald-800">{msg}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {vus.map((g) => (
          <div key={g.id} className="relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-3 pl-4 transition hover:shadow-md">
            <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: TYPE_COULEUR[g.type] ?? "#059669" }} />
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => ouvrir(g.id)} className="min-w-0 text-left">
                <p className="inline-flex items-center gap-1 truncate font-bold text-emerald-800">{g.nom} <ChevronRight size={15} /></p>
                <p className="text-xs text-stone-500"><b style={{ color: TYPE_COULEUR[g.type] }}>{TYPE[g.type] ?? g.type}</b> · {fcfa(g.montant)} · {g.frequence} · tour {g.tour}</p>
              </button>
              {g.en_attente > 0 && <span className="shrink-0 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800">{g.en_attente} à confirmer</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <p><span className="block text-stone-500">Membres</span><b>{g.nb_membres}</b></p>
              <p><span className="block text-stone-500">Confirmé</span><b>{fcfa(g.collecte)}</b></p>
              <p><span className="block text-stone-500">Créé le</span><b>{dateCourte(g.cree_le)}</b></p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="min-w-0 text-xs text-stone-600">Trésorier : <b>{g.tresorier ?? "—"}</b>{g.tresorier_tel && ` · ${telAffiche(g.tresorier_tel)}`}</p>
              {fondateur && <button onClick={() => supprimer(g)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50" aria-label={`Supprimer ${g.nom}`}>
                <Trash2 size={14} /> Supprimer
              </button>}
            </div>
          </div>
        ))}
      </div>
      {vus.length === 0 && <p className="text-sm text-stone-500">Aucun groupe.</p>}
    </section>
  );
}

function LigneAttente({ a }: { a: Attente }) {
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{a.membre} · {a.groupe}</p>
        <p className="text-xs text-stone-500">{dateCourte(a.le)} · {a.moyen}{a.tresorier_tel && ` · trésorier ${telAffiche(a.tresorier_tel)}`}</p>
      </div>
      <b className="shrink-0">{fcfa(a.montant)}</b>
    </div>
  );
}

function Paiements({ liste, versements, recharger, ouvrirGroupe }: { liste: Attente[]; versements: VersementA[]; recharger: () => void; ouvrirGroupe: (id: string) => void }) {
  const { fondateur, demander } = useContext(AdminCtx);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState<string | null>(null);
  const agir = async (cle: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setOccupe(cle); setMsg("");
    const { error } = await fn();
    setMsg(error ? "Erreur : " + error.message : ok);
    setOccupe(null);
    recharger();
  };
  return (
    <>
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-4 text-sm text-amber-900">
        {fondateur ? <><b>Tu as la main.</b> Si le trésorier ne répond pas, tu peux confirmer un paiement ou valider un versement à sa place. Vérifie d’abord avec lui ou avec le membre (appel, capture Wave…). Chaque action est notée dans le <b>Journal admin</b>.</> : <><b>Tu ne peux pas confirmer toi-même.</b> Vérifie la situation (appel, capture Wave…) puis touche <b>« Envoyer au fondateur »</b> : il recevra un dossier avec tes informations et validera.</>}
      </div>
      {fondateur && <ReglageCaisse />}
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      <Bloc titre={`Paiements à confirmer (${liste.length})`} sous="Déclarés par les membres, pas encore confirmés par le trésorier">
        {liste.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement en attente.</p> : (
          <Liste>
            {liste.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.encaisse_cotiz && <span className="mr-1.5 rounded-md bg-sky-100 px-1.5 py-0.5 text-[0.7rem] font-bold text-sky-800">Compte Cotiz</span>}{a.membre} · <span className="text-stone-600">{a.groupe}</span></p>
                  {(a.reference || a.membre_tel) && <p className="text-xs text-stone-500">{a.reference && <>Réf. Wave : <b className="text-stone-800">{a.reference}</b></>}{a.reference && a.membre_tel && " · "}{a.membre_tel && <a href={`tel:${a.membre_tel}`} className="text-emerald-700 underline">{telAffiche(a.membre_tel)}</a>}</p>}
                  <p className="text-xs text-stone-500">{dateCourte(a.le)} · {a.moyen}{a.tresorier_tel && <> · trésorier <a href={`tel:${a.tresorier_tel}`} className="font-semibold text-emerald-700 underline">{telAffiche(a.tresorier_tel)}</a></>}</p>
                </div>
                <b className="shrink-0">{fcfa(a.montant)}</b>
                {!fondateur ? (
                  <button onClick={() => demander({ motif: "Confirmer un paiement", client_nom: a.membre, groupe_nom: a.groupe, montant: a.montant, donnees: { action: "confirmer_paiement", paiement_id: a.id }, resume: `Confirmer le paiement de ${a.membre} (${fcfa(a.montant)}) · ${a.groupe}` })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white"><Send size={13} /> Envoyer au fondateur</button>
                ) : (
                <span className="flex shrink-0 gap-1.5">
                  <button disabled={!!occupe} onClick={() => confirm(`Confirmer le paiement de ${a.membre} (${fcfa(a.montant)}) à la place du trésorier ?`) && agir(a.id, () => db.rpc("admin_paiement_statut", { paiement: a.id, statut: "reussi" }), `Paiement de ${a.membre} confirmé.`)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{occupe === a.id ? "…" : "Confirmer"}</button>
                  <button disabled={!!occupe} onClick={() => confirm(`Refuser le paiement de ${a.membre} (argent non reçu) ?`) && agir(a.id, () => db.rpc("admin_paiement_statut", { paiement: a.id, statut: "echoue" }), `Paiement de ${a.membre} refusé.`)} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50">Refuser</button>
                </span>
                )}
              </div>
            ))}
          </Liste>
        )}
      </Bloc>
      <Bloc titre={`Versements à valider (${versements.length})`} sous="L’argent sort de la caisse seulement après validation">
        {versements.length === 0 ? <p className="text-sm text-stone-500">Aucun versement en attente.</p> : (
          <Liste>
            {versements.map((v) => (
              <div key={v.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <button onClick={() => ouvrirGroupe(v.groupe_id)} className="truncate text-left font-semibold">Pour {v.beneficiaire} · <span className="text-violet-700 underline decoration-violet-200">{v.groupe}</span></button>
                  <p className="text-xs text-stone-500">{dateCourte(v.le)} · tour {v.tour} · {v.moyen} · demandé par {v.demande_par ?? "—"} · <b>{v.validations}/{v.requis}</b> accords</p>
                </div>
                <b className="shrink-0">{fcfa(v.montant)}</b>
                {!fondateur ? (
                  <button onClick={() => demander({ motif: "Valider un versement", client_nom: v.beneficiaire, groupe_id: v.groupe_id, groupe_nom: v.groupe, montant: v.montant, donnees: { action: "valider_versement", versement_id: v.id }, resume: `Valider le versement de ${fcfa(v.montant)} pour ${v.beneficiaire} · ${v.groupe}` })} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white"><Send size={13} /> Envoyer au fondateur</button>
                ) : (
                <span className="flex shrink-0 gap-1.5">
                  <button disabled={!!occupe} onClick={() => confirm(`Valider le versement de ${fcfa(v.montant)} pour ${v.beneficiaire} ?`) && agir(v.id, () => db.rpc("admin_versement_decision", { demande: v.id, accepter: true }), "Versement validé.")} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{occupe === v.id ? "…" : "Valider"}</button>
                  <button disabled={!!occupe} onClick={() => confirm("Refuser ce versement ?") && agir(v.id, () => db.rpc("admin_versement_decision", { demande: v.id, accepter: false }), "Versement refusé.")} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50">Refuser</button>
                </span>
                )}
              </div>
            ))}
          </Liste>
        )}
      </Bloc>
    </>
  );
}

/** Réglage « Caisse Cotiz » : les membres paient par Wave sur le compte marchand de Cotiz */
function ReglageCaisse() {
  const [f, setF] = useState<{ actif: boolean; lien: string; nom: string } | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    db.from("parametres_app").select("cle, valeur").then(({ data, error }) => {
      if (error) return setF(null);
      const v = Object.fromEntries((data ?? []).map((r: { cle: string; valeur: string | null }) => [r.cle, r.valeur ?? ""]));
      setF({ actif: v.caisse_cotiz_actif === "oui", lien: v.caisse_cotiz_lien ?? "", nom: v.caisse_cotiz_nom ?? "" });
    });
  }, []);
  if (!f) return null;
  const enregistrer = async (actif = f.actif) => {
    setMsg("");
    for (const [c, v] of [["caisse_cotiz_lien", f.lien], ["caisse_cotiz_nom", f.nom], ["caisse_cotiz_actif", actif ? "oui" : "non"]] as const) {
      const { error } = await db.rpc("admin_parametre", { c, v });
      if (error) return setMsg("Erreur : " + error.message);
    }
    setF({ ...f, actif });
    setMsg(actif ? "Caisse Cotiz activée : les paiements Wave arrivent sur ton compte marchand." : "Caisse Cotiz désactivée : les membres paient directement le trésorier.");
  };
  return (
    <Bloc titre="Caisse Cotiz (compte marchand Wave)" sous="Quand c’est activé, les membres qui paient par Wave envoient l’argent sur ton compte marchand. Toi seul confirmes ces paiements ; le trésorier est prévenu." action={<span className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${f.actif ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>{f.actif ? "Activée" : "Désactivée"}</span>}>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
        <label className="text-xs font-semibold text-stone-500">Lien du compte marchand (pay.wave.com ou qr.wave.com)<input value={f.lien} onChange={(e) => setF({ ...f, lien: e.target.value })} placeholder="https://pay.wave.com/m/…" className={champ} autoCapitalize="none" /></label>
        <label className="text-xs font-semibold text-stone-500">Nom affiché dans Wave<input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="ex : COTIZ" className={champ} /></label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => enregistrer(true)} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white">{f.actif ? "Enregistrer" : "Activer la Caisse Cotiz"}</button>
        {f.actif && <button onClick={() => confirm("Désactiver ? Les membres paieront de nouveau directement le trésorier.") && enregistrer(false)} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700">Désactiver</button>}
      </div>
      {msg && <p className={`mt-2 text-sm font-medium ${msg.startsWith("Erreur") ? "text-red-600" : "text-emerald-800"}`}>{msg}</p>}
    </Bloc>
  );
}

const SQL16 = <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour voir cette rubrique, fais d’abord la <b>mise à jour SQL n°16</b> dans Supabase (fichier <code>migration-16-admin-complet.sql</code>).</p>;

function BadgeStatut({ statut }: { statut: MembreA["statut"] }) {
  const [l, c] = STATUT_MEMBRE[statut];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ring-1 ${c}`}>{l}</span>;
}

type FiltreStatut = "tous" | MembreA["statut"];
function Membres({ liste, typeInitial, ouvrirGroupe, ouvrirUtilisateur }: { liste: MembreA[] | null; typeInitial: string; ouvrirGroupe: (id: string) => void; ouvrirUtilisateur: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState(typeInitial);
  const [statut, setStatut] = useState<FiltreStatut>("tous");
  useEffect(() => setType(typeInitial), [typeInitial]);
  if (!liste) return SQL16;
  const parType = liste.filter((m) => type === "tous" || m.type === type);
  const vus = parType.filter((m) => statut === "tous" || m.statut === statut).filter((m) => !q || norm(m.nom).includes(norm(q)) || m.telephone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§") || norm(m.groupe).includes(norm(q)));
  // Regroupement : type → groupe → membres
  const blocs = (["tontine", "association", "collecte"] as const).map((t) => {
    const duType = vus.filter((m) => m.type === t);
    const ids = [...new Set(duType.map((m) => m.groupe_id))];
    return { t, groupes: ids.map((gid) => ({ id: gid, nom: duType.find((m) => m.groupe_id === gid)!.groupe, membres: duType.filter((m) => m.groupe_id === gid) })) };
  }).filter((b) => b.groupes.length > 0);
  const nb = (s: FiltreStatut) => parType.filter((m) => s === "tous" || m.statut === s).length;
  return (
    <>
      <Bloc titre={`${vus.length} membre${vus.length > 1 ? "s" : ""}`} sous="Tous les membres, rangés par type puis par groupe. Touche un nom pour sa fiche, un groupe pour le groupe.">
        <div className="space-y-3">
          <Recherche valeur={q} onChange={setQ} placeholder="Chercher un nom, un numéro ou un groupe…" />
          <Puces options={[{ id: "tous", label: "Tous les types", n: liste.length }, ...(["tontine", "association", "collecte"] as const).map((t) => ({ id: t, label: TYPE[t] + "s", n: liste.filter((m) => m.type === t).length }))]} valeur={type} onChange={setType} />
          <Puces options={[
            { id: "tous" as FiltreStatut, label: "Tous", n: nb("tous") },
            { id: "pas_paye" as FiltreStatut, label: "Pas encore payé", n: nb("pas_paye") },
            { id: "a_jour" as FiltreStatut, label: "À jour", n: nb("a_jour") },
            { id: "en_attente" as FiltreStatut, label: "Paiement en attente", n: nb("en_attente") },
            { id: "demande" as FiltreStatut, label: "Veulent rejoindre", n: nb("demande") },
          ]} valeur={statut} onChange={setStatut} />
        </div>
      </Bloc>
      {blocs.length === 0 && <p className="text-sm text-stone-500">Personne ne correspond.</p>}
      {blocs.map((b) => (
        <div key={b.t} className="space-y-3">
          <p className="flex items-center gap-2 pt-1 text-sm font-extrabold uppercase tracking-wide" style={{ color: TYPE_COULEUR[b.t] }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: TYPE_COULEUR[b.t] }} /> {TYPE[b.t]}s · {b.groupes.length} groupe{b.groupes.length > 1 ? "s" : ""}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {b.groupes.map((g) => {
              const aJour = g.membres.filter((m) => m.statut === "a_jour").length;
              return (
                <section key={g.id} className="relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm">
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: TYPE_COULEUR[b.t] }} />
                  <button onClick={() => ouvrirGroupe(g.id)} className="flex w-full items-center gap-2 border-b border-stone-100 py-3 pl-5 pr-4 text-left hover:bg-stone-50">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{g.nom}</span>
                      <span className="text-xs text-stone-500">{g.membres.length} membre{g.membres.length > 1 ? "s" : ""} · {aJour} à jour · {fcfa(g.membres[0].montant)} · tour {g.membres[0].tour}</span>
                    </span>
                    <ChevronRight size={16} className="text-stone-400" />
                  </button>
                  <div className="divide-y divide-stone-100 pl-1.5">
                    {g.membres.map((m) => (
                      <div key={m.membre_id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                        <Pastille nom={m.bloque ? m.nom + " (bloqué)" : m.nom} />
                        <div className="min-w-0 flex-1">
                          {m.profile_id ? (
                            <button onClick={() => ouvrirUtilisateur(m.profile_id!)} className={`truncate text-left font-semibold ${m.bloque ? "text-red-600" : ""}`}>{m.nom}</button>
                          ) : <p className="truncate font-semibold">{m.nom}</p>}
                          <p className="truncate text-xs text-stone-500">{telAffiche(m.telephone)} · {ROLE[m.role as keyof typeof ROLE] ?? m.role}{!m.profile_id && " · pas encore inscrit"} · total {fcfa(m.total_paye)}</p>
                        </div>
                        <BadgeStatut statut={m.statut} />
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function Journal({ liste }: { liste: LigneJournal[] | null }) {
  if (!liste) return SQL16;
  return (
    <Bloc titre={`${liste.length} action${liste.length > 1 ? "s" : ""}`} sous="Tout ce que l’administration a fait : paiements confirmés, comptes bloqués, profils modifiés, groupes supprimés… Ce journal ne peut pas être effacé depuis cette page.">
      {liste.length === 0 ? <p className="text-sm text-stone-500">Aucune action pour l’instant.</p> : (
        <ol className="relative space-y-4 border-l-2 border-emerald-100 pl-5">
          {liste.map((l) => (
            <li key={l.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white" />
              <p className="text-sm font-bold">{l.action}</p>
              {l.cible && <p className="text-sm text-stone-700">{l.cible}</p>}
              {l.detail && <p className="text-xs text-stone-500">{l.detail}</p>}
              <p className="mt-0.5 text-[0.7rem] text-stone-400">{new Date(l.le).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · {l.admin_email ?? "—"}</p>
            </li>
          ))}
        </ol>
      )}
    </Bloc>
  );
}

function LigneDemande({ d }: { d: Demande }) {
  const [label, cls] = RESULTAT[d.resultat] ?? [d.resultat, "bg-stone-100"];
  return (
    <div className="flex items-center gap-3 py-2.5 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{d.nom ?? "—"} {d.telephone && <span className="font-normal text-stone-500">· {telAffiche(d.telephone)}</span>}</p>
        <p className="truncate text-xs text-stone-500">{dateCourte(d.le)} · a tapé « {d.nom_saisi} », {d.naissance_saisie ? dateCourte(d.naissance_saisie) : "—"}</p>
      </div>
      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>
    </div>
  );
}

function Codes({ liste, recharger }: { liste: Demande[]; recharger: () => void }) {
  const [tel, setTel] = useState("");
  const [msg, setMsg] = useState("");
  async function reinitialiser(e: React.FormEvent) {
    e.preventDefault();
    if (tel.replace(/\D/g, "").length < 8) return setMsg("Numéro incomplet.");
    if (!confirm(`Réinitialiser le code du ${tel} ? Fais-le seulement après avoir vérifié l’identité de la personne.`)) return;
    const { data, error } = await db.rpc("admin_reinitialiser_code", { telephone: tel });
    setMsg(error ? "Erreur : " + error.message : data ? `Code réinitialisé (${data} compte${Number(data) > 1 ? "s" : ""}). La personne créera un nouveau code à la prochaine ouverture.` : "Aucun compte avec ce numéro.");
    recharger();
  }
  return (
    <>
      <form onSubmit={reinitialiser} className="space-y-3 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5">
        <p className="font-bold">Réinitialiser un code secret</p>
        <p className="text-sm text-stone-600">Pour une personne qui a oublié son code et n’a pas pu le récupérer seule. <b>Vérifie d’abord son identité</b> (appelle-la sur son numéro).</p>
        <div className="flex gap-2">
          <input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="07 07 12 34 56" className={champ} />
          <button className="shrink-0 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">Réinitialiser</button>
        </div>
        {msg && <p className="text-sm font-medium text-emerald-800">{msg}</p>}
      </form>
      <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5">
        <p className="mb-2 font-bold">Demandes « code oublié »</p>
        {liste.length === 0 ? <p className="text-sm text-stone-500">Aucune demande.</p> : <Liste>{liste.map((d, i) => <LigneDemande key={i} d={d} />)}</Liste>}
      </section>
    </>
  );
}

function Annonces({ liste, recharger }: { liste: Annonce[]; recharger: () => void }) {
  const vide = { titre: "", texte: "", lien: "", bouton: "", couleur: "vert", ordre: liste.length + 1, video: "" };
  const [f, setF] = useState(vide);
  const [msg, setMsg] = useState("");
  const maj = async (id: string, v: Partial<Annonce>) => {
    const { error } = await db.from("annonces").update(v).eq("id", id);
    setMsg(error ? "Erreur : " + error.message : "Annonce mise à jour.");
    recharger();
  };
  // Déplacer une annonce : on renumérote toute la liste 1, 2, 3… dans le nouvel ordre
  const [occupe, setOccupe] = useState(false);
  const deplacer = async (i: number, sens: -1 | 1) => {
    const j = i + sens;
    if (j < 0 || j >= liste.length) return;
    const ordre = [...liste];
    [ordre[i], ordre[j]] = [ordre[j], ordre[i]];
    setOccupe(true);
    for (let k = 0; k < ordre.length; k++) {
      if (ordre[k].ordre !== k + 1) {
        const { error } = await db.from("annonces").update({ ordre: k + 1 }).eq("id", ordre[k].id);
        if (error) { setOccupe(false); setMsg("Erreur : " + error.message); return; }
      }
    }
    setOccupe(false);
    setMsg("Ordre enregistré : c’est cet ordre qui passe sur l’accueil.");
    recharger();
  };
  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titre.trim()) return setMsg("Le titre est obligatoire.");
    const { error } = await db.from("annonces").insert({ titre: f.titre.trim(), texte: f.texte || null, lien: f.lien || null, bouton: f.bouton || null, couleur: f.couleur, ordre: Number(f.ordre) || 0, ...(f.video ? { video: f.video } : {}) });
    setMsg(error ? "Erreur : " + (error.message.includes("video") ? "fais d’abord la mise à jour SQL n°22 pour les vidéos." : error.message) : "Annonce publiée.");
    if (!error) setF({ ...vide, ordre: liste.length + 2 });
    recharger();
  }
  return (
    <>
      <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5">
        <p className="font-bold">Annonces affichées sur l’accueil</p>
        <p className="mb-2 text-xs text-stone-500">Elles passent dans cet ordre, de haut en bas. Utilise les flèches pour les déplacer.</p>
        <Liste>
          {liste.map((a, i) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="flex shrink-0 flex-col items-center">
                <button disabled={occupe || i === 0} onClick={() => deplacer(i, -1)} aria-label={`Monter « ${a.titre} »`} className="grid h-6 w-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 disabled:opacity-25"><ChevronDown size={16} className="rotate-180" /></button>
                <span className="text-[0.65rem] font-bold text-stone-400">{i + 1}</span>
                <button disabled={occupe || i === liste.length - 1} onClick={() => deplacer(i, 1)} aria-label={`Descendre « ${a.titre} »`} className="grid h-6 w-7 place-items-center rounded-md text-stone-500 hover:bg-stone-100 disabled:opacity-25"><ChevronDown size={16} /></button>
              </span>
              <span className={`h-8 w-8 shrink-0 rounded-lg ${a.couleur === "orange" ? "degrade-or" : a.couleur === "sombre" ? "bg-stone-800" : a.couleur === "bleu" ? "bg-sky-600" : "degrade-vert"}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${a.actif ? "" : "text-stone-400 line-through"}`}>{a.titre}</p>
                <p className="truncate text-xs text-stone-500">{a.video && <span className="mr-1 rounded bg-violet-100 px-1.5 py-0.5 font-bold text-violet-700">▶ Vidéo</span>}{a.texte ?? ""}{a.lien ? ` · ${a.lien}` : ""}</p>
              </div>
              <button onClick={() => maj(a.id, { actif: !a.actif })} className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold ${a.actif ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{a.actif ? "Visible" : "Masquée"}</button>
              <button
                onClick={async () => {
                  if (!confirm(`Supprimer l’annonce « ${a.titre} » ?`)) return;
                  const { error } = await db.from("annonces").delete().eq("id", a.id);
                  setMsg(error ? "Erreur : " + error.message : "Annonce supprimée.");
                  recharger();
                }}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Supprimer"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </Liste>
        {liste.length === 0 && <p className="text-sm text-stone-500">Aucune annonce.</p>}
      </section>
      <form onSubmit={ajouter} className="carte grid gap-3 p-4 md:grid-cols-2">
        <p className="font-bold md:col-span-2">Nouvelle annonce</p>
        <input value={f.titre} onChange={(e) => setF({ ...f, titre: e.target.value })} placeholder="Titre (ex : Nouveau : le tirage au sort)" className={`${champ} md:col-span-2`} />
        <input value={f.texte} onChange={(e) => setF({ ...f, texte: e.target.value })} placeholder="Texte court (facultatif)" className={`${champ} md:col-span-2`} />
        <input value={f.lien} onChange={(e) => setF({ ...f, lien: e.target.value })} placeholder="Lien (facultatif, ex : /telecharger)" className={champ} />
        <input value={f.bouton} onChange={(e) => setF({ ...f, bouton: e.target.value })} placeholder="Texte du bouton (ex : Découvrir)" className={champ} />
        <select value={f.couleur} onChange={(e) => setF({ ...f, couleur: e.target.value })} className={champ}>
          <option value="vert">Vert</option><option value="orange">Orange</option><option value="bleu">Bleu</option><option value="sombre">Sombre</option>
        </select>
        <input type="number" value={f.ordre} onChange={(e) => setF({ ...f, ordre: Number(e.target.value) })} placeholder="Ordre" className={champ} />
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-semibold">Vidéo (facultatif) : elle passe en entier dans le carrousel</span>
          <select value={VIDEOS_PUB.some(([u]) => u === f.video) || !f.video ? f.video : "autre"} onChange={(e) => setF({ ...f, video: e.target.value === "autre" ? "https://" : e.target.value })} className={champ}>
            <option value="">Pas de vidéo</option>
            {VIDEOS_PUB.map(([u, l]) => <option key={u} value={u}>{l}</option>)}
            <option value="autre">Autre vidéo (coller un lien .mp4)…</option>
          </select>
          {f.video && !VIDEOS_PUB.some(([u]) => u === f.video) && (
            <input value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} placeholder="https://…/ma-video.mp4" className={`${champ} mt-2`} />
          )}
          {f.video && <video src={f.video} muted playsInline controls className="mt-2 aspect-[16/7] w-full max-w-md rounded-xl bg-stone-900 object-cover" />}
        </label>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white md:col-span-2"><Plus size={17} /> Publier l’annonce</button>
        {msg && <p className="text-sm font-medium text-emerald-800 md:col-span-2">{msg}</p>}
      </form>
    </>
  );
}

/* ===================== Fiches détaillées ===================== */

type FicheU = {
  profil: { id: string; name: string; phone: string; date_naissance: string | null; created_at: string; bloque: boolean; bloque_motif: string | null; bloque_le: string | null } | null;
  compte: { email: string | null; is_anonymous: boolean; created_at: string; last_sign_in_at: string | null } | null;
  code: { defini: boolean; modifie_le: string; bloque_jusqua: string | null } | null;
  historique_code: { action: string; le: string }[];
  groupes: { id: string; name: string; type: string; membre_id: string; role: string; en_attente: boolean; archive: boolean; createur: boolean }[];
  paiements: { id: string; created_at: string; amount: number; penalty: number; method: string; status: string; round: number; groupe: string }[];
  tentatives: { reussie: boolean; le: string }[];
  demandes_code: { resultat: string; le: string }[];
};
type FicheG = {
  groupe: { id: string; name: string; type: string; amount: number; frequency: string; current_round: number; created_at: string; createur_nom: string | null; createur_tel: string | null; payment_phone: string | null } | null;
  membres: { id: string; name: string; phone: string; role: string; en_attente: boolean; archive: boolean; profile_id: string | null; bloque: boolean | null; nb_paiements: number }[];
  paiements: { id: string; created_at: string; amount: number; penalty: number; method: string; status: string; round: number; membre: string | null; transaction_id: string | null }[];
  versements: { id: string; created_at: string; amount: number; beneficiary_name: string; method: string; nature: string; round: number }[];
  demandes_versement: { id: string; cree_le: string; amount: number; beneficiary_name: string; statut: string; requis: number; validations: number }[];
};

const STATUT_PAIEMENT: Record<string, [string, string]> = {
  reussi: ["Confirmé", "bg-emerald-50 text-emerald-700"],
  en_attente: ["À confirmer", "bg-amber-50 text-amber-800"],
  echoue: ["Refusé", "bg-red-50 text-red-700"],
};
const ROLE: Record<string, string> = { tresorier: "Trésorier", gestionnaire: "Co-gestionnaire", membre: "Membre" };

/** Formulaire « dossier » : l'agent explique la situation, le fondateur valide */
function FormDossier({ init, fermer, envoye }: { init: DossierInit; fermer: () => void; envoye: () => void }) {
  const [f, setF] = useState({
    motif: init.motif ?? "", priorite: "normale" as "normale" | "urgente",
    client_nom: init.client_nom ?? "", client_tel: init.client_tel ?? "", groupe_nom: init.groupe_nom ?? "",
    montant: init.montant ? String(init.montant) : "", reference: init.reference ?? "", description: "", verifie: false,
  });
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const auto = !!init.donnees?.action;
  const maj = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!f.motif) return setErreur("Choisis un motif.");
    if (f.description.trim().length < 10) return setErreur("Explique la situation en quelques phrases (au moins 10 caractères).");
    setOccupe(true); setErreur("");
    const description = (auto && init.resume ? `➜ ${init.resume}\n\n` : "") + f.description.trim() + (f.verifie ? "\n\n✓ Identité du client vérifiée par téléphone." : "");
    const { error } = await db.rpc("admin_dossier_creer", {
      motif: f.motif, description, priorite: f.priorite,
      client_profile_id: init.client_profile_id ?? null, client_nom: f.client_nom || null, client_tel: f.client_tel || null,
      groupe_id: init.groupe_id ?? null, groupe_nom: f.groupe_nom || null,
      montant: f.montant ? Number(f.montant.replace(/\D/g, "")) || null : null, reference: f.reference || null,
      donnees: init.donnees ?? {},
    });
    setOccupe(false);
    if (error) return setErreur(error.message.includes("admin_dossier_creer") ? "Fais d’abord la mise à jour SQL n°17." : error.message);
    envoye();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={fermer}>
      <form onSubmit={envoyer} onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="degrade-vert relative overflow-hidden px-6 pb-5 pt-6 text-white">
          <div className="motif pointer-events-none absolute inset-0 opacity-30" />
          <div className="relative flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/20"><FolderOpen size={22} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-extrabold">Nouveau dossier pour le fondateur</p>
              <p className="text-sm text-emerald-50/85">Il le reçoit tout de suite dans son espace et le valide ou le refuse.</p>
            </div>
            <button type="button" onClick={fermer} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Fermer"><X size={18} /></button>
          </div>
        </div>
        <div className="space-y-4 p-6">
          {auto && init.resume && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-900">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Si le fondateur valide, Cotiz fera automatiquement :</p>
              <p className="mt-1 font-semibold">{init.resume}</p>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Motif *</span>
            <select value={f.motif} onChange={maj("motif")} className={champ} required disabled={auto}>
              <option value="">Choisir un motif…</option>
              {MOTIFS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-sm font-semibold">Priorité</span>
            <div className="grid grid-cols-2 gap-2">
              {(["normale", "urgente"] as const).map((pr) => (
                <button key={pr} type="button" onClick={() => setF({ ...f, priorite: pr })}
                  className={`rounded-xl border py-2.5 text-sm font-bold transition ${f.priorite === pr ? (pr === "urgente" ? "border-red-500 bg-red-50 text-red-700" : "border-emerald-600 bg-emerald-50 text-emerald-800") : "border-stone-200 text-stone-600"}`}>
                  {pr === "urgente" ? "🔴 Urgente" : "Normale"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-sm font-semibold">Client concerné</span><input value={f.client_nom} onChange={maj("client_nom")} placeholder="Nom et prénom" className={champ} /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Téléphone du client</span><input value={f.client_tel} onChange={maj("client_tel")} inputMode="tel" placeholder="07 07 12 34 56" className={champ} /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Groupe</span><input value={f.groupe_nom} onChange={maj("groupe_nom")} placeholder="Nom du groupe" className={champ} /></label>
            <label className="block"><span className="mb-1 block text-sm font-semibold">Montant (F CFA)</span><input value={f.montant} onChange={maj("montant")} inputMode="numeric" placeholder="ex : 25000" className={champ} /></label>
          </div>
          <label className="block"><span className="mb-1 block text-sm font-semibold">Référence de la transaction</span><input value={f.reference} onChange={maj("reference")} placeholder="ex : référence Wave / Orange Money" className={champ} /></label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Explication *</span>
            <textarea value={f.description} onChange={maj("description")} rows={5} required placeholder="Que s’est-il passé ? Qu’a dit le client ? Quelle preuve as-tu vue (capture, appel au trésorier…) ? Que proposes-tu ?" className={`${champ} resize-y`} />
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" checked={f.verifie} onChange={(e) => setF({ ...f, verifie: e.target.checked })} className="mt-0.5 h-4 w-4 accent-emerald-700" />
            <span>J’ai vérifié l’identité du client par téléphone.</span>
          </label>
          {erreur && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{erreur}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={fermer} className="flex-1 rounded-xl border border-stone-200 py-3 text-sm font-bold text-stone-700">Annuler</button>
            <button disabled={occupe} className="inline-flex flex-[2] items-center justify-center gap-2 rounded-xl bg-violet-700 py-3 text-sm font-bold text-white shadow-lg shadow-violet-700/25 disabled:opacity-60"><Send size={16} /> {occupe ? "Envoi…" : "Envoyer au fondateur"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

const STATUT_DOSSIER: Record<Dossier["statut"], [string, string]> = {
  ouvert: ["À traiter", "bg-amber-50 text-amber-800 ring-amber-200"],
  valide: ["Validé", "bg-emerald-50 text-emerald-700 ring-emerald-200"],
  refuse: ["Refusé", "bg-stone-100 text-stone-600 ring-stone-200"],
};

function Dossiers({ liste, fondateur, recharger, nouveau, ouvrirUtilisateur, ouvrirGroupe }: { liste: Dossier[] | null; fondateur: boolean; recharger: () => void; nouveau: () => void; ouvrirUtilisateur: (id: string) => void; ouvrirGroupe: (id: string) => void }) {
  const [filtre, setFiltre] = useState<"ouvert" | "valide" | "refuse" | "tous">("ouvert");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState<string | null>(null);
  if (!liste) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour utiliser les dossiers, fais d’abord la <b>mise à jour SQL n°17</b> dans Supabase (fichier <code>migration-17-agents-dossiers.sql</code>).</p>;
  const vus = liste.filter((d) => filtre === "tous" || d.statut === filtre);
  const traiter = async (d: Dossier, accepter: boolean) => {
    if (!confirm(accepter ? `Valider le dossier n°${d.numero} ?${d.donnees?.action ? "\n\nL’action demandée sera faite automatiquement." : ""}` : `Refuser le dossier n°${d.numero} ?`)) return;
    setOccupe(d.id); setMsg("");
    const { error } = await db.rpc("admin_dossier_traiter", { dossier: d.id, accepter, reponse: reponses[d.id] ?? null });
    // Blocage : on coupe aussi la connexion du compte
    if (!error && accepter && (d.donnees?.action === "bloquer" || d.donnees?.action === "debloquer") && d.donnees.profile_id) {
      const { data } = await db.auth.getSession();
      await fetch("/api/admin/bannir", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ profileId: d.donnees.profile_id, bannir: d.donnees.action === "bloquer" }) }).catch(() => null);
    }
    setOccupe(null);
    setMsg(error ? "Erreur : " + error.message : accepter ? `Dossier n°${d.numero} validé.` : `Dossier n°${d.numero} refusé.`);
    recharger();
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <Puces options={[
            { id: "ouvert" as const, label: "À traiter", n: liste.filter((d) => d.statut === "ouvert").length },
            { id: "valide" as const, label: "Validés", n: liste.filter((d) => d.statut === "valide").length },
            { id: "refuse" as const, label: "Refusés", n: liste.filter((d) => d.statut === "refuse").length },
            { id: "tous" as const, label: "Tous", n: liste.length },
          ]} valeur={filtre} onChange={setFiltre} />
        </div>
        <button onClick={nouveau} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm"><Plus size={16} /> Nouveau dossier</button>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      {vus.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">{filtre === "ouvert" ? "Aucun dossier à traiter." : "Aucun dossier."}</p>}
      <div className="space-y-3">
        {vus.map((d) => {
          const [l, c] = STATUT_DOSSIER[d.statut];
          return (
            <article key={d.id} className={`relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm lg:p-5 ${d.priorite === "urgente" && d.statut === "ouvert" ? "border-red-200" : "border-stone-200/80"}`}>
              <span className={`absolute inset-y-0 left-0 w-1.5 ${d.statut === "ouvert" ? (d.priorite === "urgente" ? "bg-red-500" : "bg-amber-400") : d.statut === "valide" ? "bg-emerald-500" : "bg-stone-300"}`} />
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-stone-400">Dossier n°{d.numero} · {new Date(d.cree_le).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })} · par {d.cree_par}</p>
                  <p className="mt-0.5 text-base font-extrabold">{d.motif}</p>
                </div>
                {d.priorite === "urgente" && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[0.7rem] font-bold text-white">URGENT</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ring-1 ${c}`}>{l}</span>
              </div>
              <div className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                {d.client_nom && <p><span className="text-stone-500">Client : </span>{d.client_profile_id ? <button onClick={() => ouvrirUtilisateur(d.client_profile_id!)} className="font-semibold text-sky-700 underline decoration-sky-200">{d.client_nom}</button> : <b>{d.client_nom}</b>}{d.client_tel && <> · <a href={`tel:${d.client_tel}`} className="text-emerald-700 underline">{telAffiche(d.client_tel)}</a></>}</p>}
                {d.groupe_nom && <p><span className="text-stone-500">Groupe : </span>{d.groupe_id ? <button onClick={() => ouvrirGroupe(d.groupe_id!)} className="font-semibold text-violet-700 underline decoration-violet-200">{d.groupe_nom}</button> : <b>{d.groupe_nom}</b>}</p>}
                {d.montant !== null && <p><span className="text-stone-500">Montant : </span><b>{fcfa(d.montant)}</b></p>}
                {d.reference && <p><span className="text-stone-500">Référence : </span><b>{d.reference}</b></p>}
              </div>
              <p className="mt-3 whitespace-pre-line rounded-xl bg-stone-50 p-3 text-sm text-stone-800">{d.description}</p>
              {d.donnees?.action && d.statut === "ouvert" && <p className="mt-2 text-xs font-semibold text-violet-700">⚡ Si tu valides, l’action est faite automatiquement.</p>}
              {d.statut !== "ouvert" && (
                <p className="mt-3 text-sm text-stone-600"><b>{d.statut === "valide" ? "Validé" : "Refusé"}</b> par {d.traite_par ?? "—"}{d.traite_le && ` le ${dateCourte(d.traite_le)}`}{d.reponse && <> · « {d.reponse} »</>}</p>
              )}
              {fondateur && d.statut === "ouvert" && (
                <div className="mt-3 space-y-2">
                  <input value={reponses[d.id] ?? ""} onChange={(e) => setReponses({ ...reponses, [d.id]: e.target.value })} placeholder="Réponse à l’agent (facultatif)" className={champ} />
                  <div className="flex gap-2">
                    <button disabled={!!occupe} onClick={() => traiter(d, true)} className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-50">{occupe === d.id ? "…" : "Valider"}</button>
                    <button disabled={!!occupe} onClick={() => traiter(d, false)} className="flex-1 rounded-xl border border-stone-200 py-2.5 text-sm font-bold text-stone-700 disabled:opacity-50">Refuser</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

/** Fenêtre simple au centre de l'écran */
function Fenetre({ titre, fermer, children }: { titre: string; fermer: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={fermer}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-lg font-extrabold">{titre}</p>
          <button type="button" onClick={fermer} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100" aria-label="Fermer"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ChangerMotDePasse({ fermer }: { fermer: () => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  async function valider(e: React.FormEvent) {
    e.preventDefault();
    if (a.length < 8) return setMsg("8 caractères minimum.");
    if (a !== b) return setMsg("Les deux mots de passe ne sont pas pareils.");
    const { error } = await db.auth.updateUser({ password: a });
    if (error) return setMsg("Erreur : " + error.message);
    setOk(true);
  }
  return (
    <Fenetre titre="Changer mon mot de passe" fermer={fermer}>
      {ok ? (
        <div className="space-y-3">
          <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">Mot de passe changé. Garde-le pour toi : ne le donne à personne, même à un collègue.</p>
          <button onClick={fermer} className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">Fermer</button>
        </div>
      ) : (
        <form onSubmit={valider} className="space-y-3">
          <input type="password" value={a} onChange={(e) => setA(e.target.value)} placeholder="Nouveau mot de passe" autoComplete="new-password" className={champ} />
          <input type="password" value={b} onChange={(e) => setB(e.target.value)} placeholder="Encore une fois" autoComplete="new-password" className={champ} />
          {msg && <p className="text-sm font-medium text-red-600">{msg}</p>}
          <button className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">Enregistrer</button>
        </form>
      )}
    </Fenetre>
  );
}

const STATUT_REQ: Record<Requete["statut"], [string, string]> = {
  nouvelle: ["Nouvelle", "bg-sky-600 text-white"],
  en_cours: ["En cours", "bg-amber-50 text-amber-800 ring-1 ring-amber-200"],
  resolue: ["Répondu", "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"],
};

function Requetes({ liste, moi, recharger, ouvrirUtilisateur }: { liste: Requete[] | null; moi: string; recharger: () => void; ouvrirUtilisateur: (id: string) => void }) {
  const { demander } = useContext(AdminCtx);
  const [filtre, setFiltre] = useState<"a_traiter" | "miennes" | "resolue" | "toutes">("a_traiter");
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState<string | null>(null);
  if (!liste) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour voir les requêtes des clients, fais d’abord la <b>mise à jour SQL n°18</b> dans Supabase.</p>;
  const tests = {
    a_traiter: (r: Requete) => r.statut !== "resolue",
    miennes: (r: Requete) => (r.agent_email ?? "").toLowerCase() === moi.toLowerCase(),
    resolue: (r: Requete) => r.statut === "resolue",
    toutes: () => true,
  };
  const vus = liste.filter(tests[filtre]);
  const agir = async (id: string, fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setOccupe(id); setMsg("");
    const { error } = await fn();
    setOccupe(null);
    setMsg(error ? "Erreur : " + error.message : ok);
    if (!error) setReponses((x) => ({ ...x, [id]: "" }));
    recharger();
  };
  return (
    <>
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 to-white p-4 text-sm text-sky-900">
        Les clients écrivent depuis l’application (page <b>Aide</b>). Touche <b>« Je m’en occupe »</b>, appelle le client si besoin, puis réponds : il reçoit ta réponse en notification. S’il faut une action que tu ne peux pas faire, envoie un dossier au fondateur.
      </div>
      <Puces options={[
        { id: "a_traiter" as const, label: "À traiter", n: liste.filter(tests.a_traiter).length },
        { id: "miennes" as const, label: "Les miennes", n: liste.filter(tests.miennes).length },
        { id: "resolue" as const, label: "Répondues", n: liste.filter(tests.resolue).length },
        { id: "toutes" as const, label: "Toutes", n: liste.length },
      ]} valeur={filtre} onChange={setFiltre} />
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      {vus.length === 0 && <p className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">{filtre === "a_traiter" ? "Aucune requête en attente. 🎉" : "Rien ici."}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {vus.map((r) => {
          const [l, c] = STATUT_REQ[r.statut];
          const aMoi = (r.agent_email ?? "").toLowerCase() === moi.toLowerCase();
          return (
            <article key={r.id} className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm ${r.statut === "nouvelle" ? "border-sky-200" : "border-stone-200/80"}`}>
              <div className="flex items-start gap-3">
                <Pastille nom={r.nom ?? "?"} />
                <div className="min-w-0 flex-1">
                  <button onClick={() => ouvrirUtilisateur(r.profile_id)} className="truncate text-left font-bold hover:underline">{r.nom ?? "Client"}</button>
                  <p className="text-xs text-stone-500">{r.telephone && <a href={`tel:${r.telephone}`} className="font-semibold text-emerald-700 underline">{telAffiche(r.telephone)}</a>} · n°{r.numero} · {new Date(r.cree_le).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold ${c}`}>{l}</span>
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-sky-700">{r.motif}</p>
              <p className="mt-1 whitespace-pre-line text-sm text-stone-800">{r.message}</p>
              {r.agent_email && <p className="mt-2 text-xs text-stone-500">Pris en charge par {aMoi ? "toi" : r.agent_email.replace("@tontine-et-cotise.vercel.app", "").replace("agent", "n°")}</p>}
              {r.reponse && <p className="mt-2 rounded-xl bg-emerald-50 p-2.5 text-sm text-emerald-900"><b>Réponse :</b> {r.reponse}</p>}
              {r.statut !== "resolue" && (
                <div className="mt-3 space-y-2 border-t border-stone-100 pt-3">
                  {r.statut === "nouvelle" && (
                    <button disabled={!!occupe} onClick={() => agir(r.id, () => db.rpc("admin_requete_prendre", { r: r.id }), "Requête prise en charge.")} className="w-full rounded-xl bg-sky-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">Je m’en occupe</button>
                  )}
                  <textarea value={reponses[r.id] ?? ""} onChange={(e) => setReponses({ ...reponses, [r.id]: e.target.value })} rows={2} placeholder="Ta réponse au client…" className={`${champ} resize-y`} />
                  <div className="flex flex-wrap gap-2">
                    <button disabled={!!occupe || !(reponses[r.id] ?? "").trim()} onClick={() => agir(r.id, () => db.rpc("admin_requete_repondre", { r: r.id, texte: reponses[r.id], resoudre: true }), "Réponse envoyée au client.")} className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white disabled:opacity-40">Répondre et clore</button>
                    <button disabled={!!occupe || !(reponses[r.id] ?? "").trim()} onClick={() => agir(r.id, () => db.rpc("admin_requete_repondre", { r: r.id, texte: reponses[r.id], resoudre: false }), "Réponse envoyée, requête gardée ouverte.")} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-bold text-stone-700 disabled:opacity-40">Répondre</button>
                    <button onClick={() => demander({ motif: r.motif.includes("paiement") ? "Confirmer un paiement" : "Réclamation d’un client", client_profile_id: r.profile_id, client_nom: r.nom, client_tel: r.telephone })} className="inline-flex items-center gap-1 rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-bold text-violet-700"><Send size={14} /> Dossier</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}

const JOURS_SEMAINE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lundiDe = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };

function Planning({ fondateur, equipe, moi }: { fondateur: boolean; equipe: Membre_Equipe[]; moi: string }) {
  const [filtre, setFiltre] = useState<string>(fondateur ? "tous" : "moi");
  const [lundi, setLundi] = useState(() => lundiDe(new Date()));
  const [liste, setListe] = useState<Creneau[] | null>(null);
  const [msg, setMsg] = useState("");
  const vide = { email: "", jour: iso(new Date()), debut: "08:00", fin: "16:00", note: "" };
  const [f, setF] = useState(vide);
  const [enEdition, setEnEdition] = useState<Creneau | null>(null);
  const [occupe, setOccupe] = useState(false);
  const jours = Array.from({ length: 7 }, (_, k) => { const d = new Date(lundi); d.setDate(d.getDate() + k); return d; });
  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_planning", { du: iso(jours[0]), au: iso(jours[6]) });
    setListe(error ? null : ((data as Creneau[]) ?? []));
  }, [lundi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [charger]);
  const decaler = (n: number) => { const d = new Date(lundi); d.setDate(d.getDate() + 7 * n); setLundi(d); };
  const h = (t: string) => t.slice(0, 5).replace(":", "h");
  const nomDe = (email: string) => { const a = equipe.find((x) => x.email === email); return a ? `${a.numero ?? ""} ${a.nom ?? a.email}`.trim() : email; };

  const supprimer = async (c: Creneau, demander = true) => {
    if (demander && !confirm(`Supprimer le créneau de ${c.nom ?? c.email} le ${new Date(c.jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} (${h(c.debut)} – ${h(c.fin)}) ?`)) return false;
    const { error } = await db.rpc("admin_planning_supprimer", { i: c.id });
    if (error) { setMsg("Erreur : " + error.message); return false; }
    return true;
  };

  const modifier = (c: Creneau) => {
    setEnEdition(c);
    setF({ email: c.email, jour: c.jour, debut: c.debut.slice(0, 5), fin: c.fin.slice(0, 5), note: c.note ?? "" });
    setMsg("");
    setTimeout(() => document.getElementById("form-creneau")?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };
  const annulerEdition = () => { setEnEdition(null); setF(vide); setMsg(""); };

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    if (!f.email) return setMsg("Choisis un agent.");
    if (f.fin <= f.debut) return setMsg("L’heure de fin doit être après l’heure de début.");
    // Pas deux créneaux qui se chevauchent pour le même agent le même jour
    const chevauche = (liste ?? []).find((c) => c.email === f.email && c.jour === f.jour && c.id !== enEdition?.id && f.debut < c.fin.slice(0, 5) && f.fin > c.debut.slice(0, 5));
    if (chevauche) return setMsg(`Ce créneau chevauche celui de ${h(chevauche.debut)} – ${h(chevauche.fin)} pour cet agent. Modifie ou supprime l’autre d’abord.`);
    setOccupe(true); setMsg("");
    const { error } = await db.rpc("admin_planning_ajouter", { adresse: f.email, j: f.jour, de: f.debut, a: f.fin, remarque: f.note || null });
    if (!error && enEdition) await supprimer(enEdition, false); // modification = nouveau créneau, puis on retire l'ancien
    setOccupe(false);
    if (error) return setMsg("Erreur : " + error.message);
    setMsg(enEdition ? "Créneau modifié." : "Créneau ajouté.");
    setEnEdition(null);
    setF((x) => ({ ...vide, email: x.email }));
    charger();
  }

  const viderSemaine = async () => {
    if (!liste?.length) return;
    if (!confirm(`Supprimer les ${liste.length} créneaux de cette semaine ? Cette action ne peut pas être annulée.`)) return;
    setOccupe(true);
    for (const c of liste) await supprimer(c, false);
    setOccupe(false);
    setMsg("Semaine vidée.");
    charger();
  };
  const copierSemainePrecedente = async () => {
    const avant = jours.map((d) => { const x = new Date(d); x.setDate(x.getDate() - 7); return x; });
    const { data, error } = await db.rpc("admin_planning", { du: iso(avant[0]), au: iso(avant[6]) });
    if (error) return setMsg("Erreur : " + error.message);
    const anciens = (data as Creneau[]) ?? [];
    if (!anciens.length) return setMsg("La semaine précédente est vide : rien à copier.");
    if (!confirm(`Copier les ${anciens.length} créneaux de la semaine précédente sur cette semaine ?`)) return;
    setOccupe(true);
    for (const c of anciens) {
      const d = new Date(c.jour + "T12:00"); d.setDate(d.getDate() + 7);
      const deja = (liste ?? []).some((x) => x.email === c.email && x.jour === iso(d) && x.debut === c.debut);
      if (!deja) await db.rpc("admin_planning_ajouter", { adresse: c.email, j: iso(d), de: c.debut.slice(0, 5), a: c.fin.slice(0, 5), remarque: c.note });
    }
    setOccupe(false);
    setMsg("Semaine précédente copiée.");
    charger();
  };

  if (liste === null) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour le planning, fais d’abord la <b>mise à jour SQL n°18</b> dans Supabase.</p>;
  const aujourdhui = iso(new Date());
  const agents = equipe.filter((a) => a.role === "agent");
  const estMoi = (c: Creneau) => c.email.toLowerCase() === moi.toLowerCase();
  // Personnes présentes cette semaine (pour les filtres)
  const personnes = [...new Map(liste.map((c) => [c.email, { email: c.email, label: `${c.numero ? c.numero + " · " : ""}${c.nom ?? c.email}` }])).values()].sort((a, b) => a.label.localeCompare(b.label));
  const visibles = liste.filter((c) => filtre === "tous" || (filtre === "moi" ? estMoi(c) : c.email === filtre));
  const mesHeures = liste.filter(estMoi).reduce((t, c) => t + (Number(c.fin.slice(0, 2)) * 60 + Number(c.fin.slice(3, 5)) - Number(c.debut.slice(0, 2)) * 60 - Number(c.debut.slice(3, 5))) / 60, 0);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => decaler(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 bg-white" aria-label="Semaine précédente"><ChevronLeft size={18} /></button>
        <p className="min-w-0 flex-1 text-center font-bold">Semaine du {jours[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au {jours[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>
        <button onClick={() => decaler(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-stone-200 bg-white" aria-label="Semaine suivante"><ChevronRight size={18} /></button>
        <button onClick={() => setLundi(lundiDe(new Date()))} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold">Aujourd’hui</button>
      </div>
      {fondateur && (
        <div className="flex flex-wrap gap-2">
          <button disabled={occupe} onClick={copierSemainePrecedente} className="inline-flex items-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 disabled:opacity-50"><Copy size={15} /> Copier la semaine précédente</button>
          {liste.length > 0 && <button disabled={occupe} onClick={viderSemaine} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 size={15} /> Vider cette semaine</button>}
        </div>
      )}
      <Puces
        options={[
          { id: "tous", label: "Tout le monde", n: liste.length },
          ...(!fondateur || liste.some(estMoi) ? [{ id: "moi", label: "Mon planning", n: liste.filter(estMoi).length }] : []),
          ...personnes.filter((x) => x.email.toLowerCase() !== moi.toLowerCase()).map((x) => ({ id: x.email, label: x.label, n: liste.filter((c) => c.email === x.email).length })),
        ]}
        valeur={filtre}
        onChange={setFiltre}
      />
      {!fondateur && <p className="text-sm text-stone-600">Cette semaine, tu travailles <b>{liste.filter(estMoi).length} fois</b>{mesHeures > 0 ? <> pour <b>{Math.round(mesHeures * 10) / 10} h</b></> : null}. Tes créneaux sont en vert foncé.</p>}
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") || msg.includes("chevauche") || msg.includes("doit") || msg.includes("Choisis") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {jours.map((d, k) => {
          const duJour = visibles.filter((c) => c.jour === iso(d));
          const estAuj = iso(d) === aujourdhui;
          return (
            <div key={k} className={`min-h-[110px] rounded-2xl border p-2.5 ${estAuj ? "border-teal-400 bg-teal-50/60" : "border-stone-200/80 bg-white"}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <p className={`text-xs font-bold ${estAuj ? "text-teal-800" : "text-stone-500"}`}>{JOURS_SEMAINE[k]} {d.getDate()}{estAuj && " · aujourd’hui"}</p>
                {fondateur && (
                  <button onClick={() => { setEnEdition(null); setF((x) => ({ ...x, jour: iso(d) })); document.getElementById("form-creneau")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="grid h-6 w-6 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-teal-100 hover:text-teal-800" aria-label={`Ajouter un créneau le ${JOURS_SEMAINE[k]} ${d.getDate()}`}><Plus size={14} /></button>
                )}
              </div>
              <div className="space-y-1.5">
                {duJour.map((c) => (
                  <div key={c.id} className={`rounded-xl px-2.5 py-2 ${enEdition?.id === c.id ? "bg-amber-500 text-white ring-2 ring-amber-300" : !fondateur && !estMoi(c) ? "bg-teal-50 text-teal-900 ring-1 ring-teal-200" : "bg-teal-700 text-white"}`}>
                    <p className="text-xs font-bold" title={c.fonctions?.join(", ")}>{h(c.debut)} – {h(c.fin)}</p>
                    <p className={`truncate text-[0.7rem] ${!fondateur && !estMoi(c) ? "text-teal-700" : "text-teal-50"}`}>{estMoi(c) ? "Toi" : `${c.numero ? `${c.numero} · ` : ""}${c.nom ?? c.email}`}</p>
                    {!!c.fonctions?.length && <p className={`truncate text-[0.65rem] italic ${!fondateur && !estMoi(c) ? "text-teal-700/80" : "text-teal-50/90"}`}>{c.fonctions[0]}</p>}
                    {c.note && <p className={`truncate text-[0.7rem] ${!fondateur && !estMoi(c) ? "text-teal-700/80" : "text-teal-50/90"}`}>{c.note}</p>}
                    {fondateur && (
                      <div className="mt-1.5 flex gap-1">
                        <button onClick={() => modifier(c)} className="flex-1 rounded-lg bg-white/20 px-1.5 py-1 text-[0.7rem] font-bold hover:bg-white/30">Modifier</button>
                        <button onClick={async () => { if (await supprimer(c)) { if (enEdition?.id === c.id) annulerEdition(); setMsg("Créneau supprimé."); charger(); } }} className="grid w-7 place-items-center rounded-lg bg-white/20 hover:bg-red-500" aria-label="Supprimer ce créneau"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                ))}
                {duJour.length === 0 && <p className="text-[0.7rem] text-stone-300">—</p>}
              </div>
            </div>
          );
        })}
      </div>
      {fondateur && (
        <div id="form-creneau" className="scroll-mt-24">
          <Bloc titre={enEdition ? "Modifier le créneau" : "Ajouter un créneau de travail"} sous={enEdition ? `Créneau de ${enEdition.nom ?? enEdition.email} : change le jour ou les heures, puis enregistre.` : "Choisis l’agent, le jour et les heures. Le « + » d’un jour remplit la date."}>
            {agents.length === 0 ? <p className="text-sm text-stone-500">Ajoute d’abord un agent dans l’onglet Équipe.</p> : (
              <form onSubmit={enregistrer} className="grid gap-2 sm:grid-cols-6">
                <select value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`${champ} sm:col-span-2`}>
                  <option value="">Agent…</option>
                  {agents.map((a) => <option key={a.email} value={a.email}>{nomDe(a.email)}</option>)}
                </select>
                <input type="date" value={f.jour} onChange={(e) => setF({ ...f, jour: e.target.value })} className={champ} />
                <input type="time" value={f.debut} onChange={(e) => setF({ ...f, debut: e.target.value })} className={champ} aria-label="Heure de début" />
                <input type="time" value={f.fin} onChange={(e) => setF({ ...f, fin: e.target.value })} className={champ} aria-label="Heure de fin" />
                <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Note (facultatif)" className={champ} />
                <div className={`flex gap-2 sm:col-span-6`}>
                  <button disabled={occupe} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${enEdition ? "bg-amber-600" : "bg-teal-700"}`}>{occupe ? "…" : enEdition ? "Enregistrer la modification" : "Ajouter au planning"}</button>
                  {enEdition && <button type="button" onClick={annulerEdition} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold text-stone-700">Annuler</button>}
                </div>
              </form>
            )}
          </Bloc>
        </div>
      )}
    </>
  );
}

function BadgeCnps({ ok }: { ok: boolean }) {
  return ok
    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-800"><BadgeCheck size={12} /> CNPS déclaré</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-red-700"><ShieldX size={12} /> CNPS non déclaré</span>;
}

/** Photo stockée en privé : lien temporaire */
function PhotoPrivee({ chemin, nom, taille = 44 }: { chemin: string | null; nom: string; taille?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!chemin) return setUrl(null);
    db.storage.from("agents").createSignedUrl(chemin, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [chemin]);
  // eslint-disable-next-line @next/next/no-img-element
  if (url) return <img src={url} alt={nom} style={{ width: taille, height: taille }} className="shrink-0 rounded-full object-cover ring-2 ring-white" />;
  return <span style={{ width: taille, height: taille }} className="grid shrink-0 place-items-center"><Pastille nom={nom} /></span>;
}

function Equipe({ liste, moi, recharger }: { liste: Membre_Equipe[]; moi: string; recharger: () => void }) {
  const [f, setF] = useState({ nom: "", telephone: "", salaire: "", mdp: "" });
  const [fonctionsNouveau, setFonctionsNouveau] = useState<string[]>(["Agent du service client"]);
  const [roleNouveau, setRoleNouveau] = useState<"agent" | "fondateur">("agent");
  const [msg, setMsg] = useState("");
  const [nouveau, setNouveau] = useState<{ numero: number; mdp: string; nom: string } | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [fiche, setFiche] = useState<string | null>(null);
  const proposer = () => {
    const c = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    const a = new Uint32Array(10); crypto.getRandomValues(a);
    setF((x) => ({ ...x, mdp: [...a].map((n) => c[n % c.length]).join("") }));
  };
  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    setOccupe(true); setMsg(""); setNouveau(null);
    const { data } = await db.auth.getSession();
    const r = await fetch("/api/admin/equipe", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ nom: f.nom, telephone: f.telephone, salaire: f.salaire, motDePasse: f.mdp, fonctions: fonctionsNouveau, role: roleNouveau }) }).then((x) => x.json()).catch(() => ({ ok: false, erreur: "Réseau indisponible." }));
    setOccupe(false);
    if (!r.ok) return setMsg("Erreur : " + r.erreur);
    setNouveau({ numero: r.numero, mdp: f.mdp, nom: f.nom });
    setF({ nom: "", telephone: "", salaire: "", mdp: "" });
    recharger();
  }
  const retirer = async (m: Membre_Equipe) => {
    if (!confirm(`Retirer l’accès de ${m.nom ?? m.email} ? Il ne pourra plus ouvrir l’administration.`)) return;
    const { error } = await db.rpc("admin_retirer_agent", { adresse: m.email });
    setMsg(error ? "Erreur : " + error.message : `${m.nom ?? m.email} n’a plus accès.`);
    recharger();
  };
  const retirerTous = async () => {
    const n = liste.filter((a) => a.role === "agent").length;
    const saisie = prompt(`Retirer l’accès des ${n} agents ? Leurs fiches seront supprimées. Toi, tu gardes ton accès.\n\nPour confirmer, écris : RETIRER TOUS LES AGENTS`);
    if (saisie === null) return;
    if (saisie.trim() !== "RETIRER TOUS LES AGENTS") return setMsg("Confirmation incorrecte : personne n’a été retiré.");
    const { data, error } = await db.rpc("admin_retirer_tous_agents", { confirmation: "RETIRER TOUS LES AGENTS" });
    setMsg(error ? "Erreur : " + error.message : `${data} agent(s) retiré(s).`);
    recharger();
  };
  const agents = liste.filter((a) => a.role === "agent");
  const masse = agents.reduce((t, a) => t + (a.salaire ?? 0), 0);
  const ouverte = liste.find((a) => a.email === fiche);
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Agents" valeur={String(agents.length)} detail="dans l’équipe" icone={Headset} ton="sky" />
        <Chiffre label="Masse salariale" valeur={fcfa(masse)} detail="par mois" icone={Wallet} ton="emerald" />
        <Chiffre label="CNPS déclarés" valeur={`${agents.filter((a) => a.cnps_declare).length} / ${agents.length}`} detail="agents déclarés" icone={BadgeCheck} ton="teal" />
        <Chiffre label="Non déclarés" valeur={String(agents.filter((a) => !a.cnps_declare).length)} detail="à régulariser" icone={ShieldX} ton="red" />
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") || msg.startsWith("Confirmation") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Bloc titre="Ajouter un agent" sous="Cotiz lui donne le numéro suivant (2702, 2703…). Il se connecte avec ce numéro et le mot de passe provisoire.">
          {nouveau ? (
            <div className="space-y-3">
              <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-800 p-5 text-white">
                <p className="text-sm text-emerald-100">Accès de {nouveau.nom}{roleNouveau === "fondateur" ? " · co-fondateur" : ""}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-emerald-200">Adresse</p>
                <p className="font-bold">tontine-et-cotise.vercel.app/admin</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div><p className="text-xs uppercase tracking-wide text-emerald-200">Numéro</p><p className="text-3xl font-extrabold">{nouveau.numero}</p></div>
                  <div><p className="text-xs uppercase tracking-wide text-emerald-200">Mot de passe</p><p className="break-all font-mono text-lg font-bold">{nouveau.mdp}</p></div>
                </div>
              </div>
              <p className="text-xs text-stone-500">Note ces accès maintenant : le mot de passe ne sera plus affiché. Demande à l’agent de le changer à sa première connexion (bouton « Changer mon mot de passe »).</p>
              <button onClick={() => navigator.clipboard?.writeText(`Cotiz — accès service client\nAdresse : https://tontine-et-cotise.vercel.app/admin\nNuméro : ${nouveau.numero}\nMot de passe : ${nouveau.mdp}`)} className="w-full rounded-xl border border-stone-200 py-2.5 text-sm font-bold"><Copy size={14} className="mr-1 inline" /> Copier les accès</button>
              <button onClick={() => setNouveau(null)} className="w-full rounded-xl bg-sky-700 py-2.5 text-sm font-bold text-white">Ajouter un autre agent</button>
            </div>
          ) : (
            <form onSubmit={ajouter} className="space-y-3">
              <label className="block"><span className="mb-1 block text-sm font-semibold">Nom et prénoms</span><input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} placeholder="ex : Koné Aïcha" className={champ} required /></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="mb-1 block text-sm font-semibold">Numéro Wave</span><input value={f.telephone} onChange={(e) => setF({ ...f, telephone: e.target.value })} inputMode="tel" placeholder="07 07 12 34 56" className={champ} /></label>
                <label className="block"><span className="mb-1 block text-sm font-semibold">Salaire mensuel</span><input value={f.salaire} onChange={(e) => setF({ ...f, salaire: e.target.value })} inputMode="numeric" placeholder="ex : 120000" className={champ} /></label>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-semibold">Rôle</span>
                <div className="grid grid-cols-2 gap-2">
                  {([["agent", "Agent", "Service client, sans pouvoirs sensibles"], ["fondateur", "Co-fondateur", "Tous les pouvoirs, comme toi"]] as const).map(([id, t, d]) => (
                    <button key={id} type="button" onClick={() => setRoleNouveau(id)} className={`rounded-xl border p-2.5 text-left text-xs ${roleNouveau === id ? (id === "fondateur" ? "border-emerald-600 bg-emerald-50" : "border-sky-600 bg-sky-50") : "border-stone-200"}`}>
                      <span className="block text-sm font-bold">{t}</span>{d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-semibold">Fonction(s)</span>
                <ChoixFonctions valeur={fonctionsNouveau} onChange={setFonctionsNouveau} />
              </div>
              <label className="block">
                <span className="mb-1 flex items-center justify-between text-sm font-semibold">Mot de passe provisoire <button type="button" onClick={proposer} className="text-xs font-bold text-sky-700">Générer</button></span>
                <input value={f.mdp} onChange={(e) => setF({ ...f, mdp: e.target.value })} placeholder="8 caractères minimum" minLength={8} className={`${champ} font-mono`} required />
              </label>
              <button disabled={occupe} className="w-full rounded-xl bg-sky-700 py-3 text-sm font-bold text-white disabled:opacity-60">{occupe ? "Création…" : "Créer l’agent et son numéro"}</button>
            </form>
          )}
        </Bloc>
        <Bloc titre={`Équipe (${liste.length})`} sous="Touche un agent pour ouvrir son dossier" action={agents.length > 0 ? <button onClick={retirerTous} className="text-xs font-bold text-red-600">Retirer tous les agents</button> : undefined}>
          <Liste>
            {liste.map((m) => (
              <button key={m.email} onClick={() => setFiche(m.email)} className="flex w-full items-center gap-3 py-3 text-left text-sm enabled:hover:bg-stone-50" disabled={m.email.toLowerCase() === moi.toLowerCase()}>
                <PhotoPrivee chemin={m.photo_path} nom={m.nom ?? m.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold"><span className="mr-1.5 rounded-md bg-stone-900 px-1.5 py-0.5 font-mono text-[0.7rem] text-white">{m.numero ?? "—"}</span>{m.nom ?? m.email}{m.email.toLowerCase() === moi.toLowerCase() && <span className="font-normal text-stone-400"> (toi)</span>}</p>
                  {!!m.fonctions?.length && <p className="truncate text-xs font-semibold text-sky-700">{m.fonctions.join(" · ")}</p>}
                  <p className="truncate text-xs text-stone-500">{m.role === "fondateur" ? "Fondateur" : `${m.telephone ? telAffiche(m.telephone) : "pas de numéro Wave"} · ${m.salaire ? fcfa(m.salaire) + "/mois" : "salaire non renseigné"}`}</p>
                </div>
                {m.role === "agent" ? <BadgeCnps ok={m.cnps_declare} /> : <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[0.7rem] font-bold text-emerald-800">{m.email.toLowerCase() === moi.toLowerCase() ? "Fondateur (toi)" : "Co-fondateur"}</span>}
              </button>
            ))}
          </Liste>
        </Bloc>
      </div>
      {ouverte && <FicheAgent a={ouverte} fermer={() => setFiche(null)} recharger={recharger} retirer={() => { setFiche(null); retirer(ouverte); }} />}
      <p className="text-xs text-stone-500">Plusieurs fondateurs ont exactement les mêmes pouvoirs (revenus, salaires, suppression, équipe…). Nomme co-fondateur seulement un associé de confiance. Pour retirer un co-fondateur : repasse-le agent, puis retire-le.</p>
    </>
  );
}

function FicheAgent({ a, fermer, recharger, retirer }: { a: Membre_Equipe; fermer: () => void; recharger: () => void; retirer: () => void }) {
  const [f, setF] = useState({
    nom: a.nom ?? "", telephone: a.telephone ?? "", salaire: a.salaire ? String(a.salaire) : "", cni_numero: a.cni_numero ?? "",
    cnps_declare: a.cnps_declare, cnps_numero: a.cnps_numero ?? "", cnps_le: a.cnps_le ?? "", embauche_le: a.embauche_le ?? "",
    contrat: a.contrat ?? "", contact_urgence: a.contact_urgence ?? "", note: a.note ?? "",
    fonctions: a.fonctions ?? [],
  });
  const [msg, setMsg] = useState("");
  const [envoi, setEnvoi] = useState("");
  const maj = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await db.rpc("admin_agent_modifier", { adresse: a.email, champs: { ...f, cnps_declare: String(f.cnps_declare) } });
    setMsg(error ? "Erreur : " + error.message : f.fonctions.length && !("fonctions" in a) ? "Dossier enregistré. Pour garder les fonctions, fais la mise à jour SQL n°21." : "Dossier enregistré.");
    recharger();
  }
  async function televerser(type: "photo" | "cni", fichier: File | undefined) {
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) return setMsg("Erreur : image trop lourde (5 Mo maximum).");
    setEnvoi(type); setMsg("");
    const ext = (fichier.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const chemin = `${a.numero ?? "agent"}/${type}-${Date.now()}.${ext}`;
    const { error } = await db.storage.from("agents").upload(chemin, fichier, { upsert: true, contentType: fichier.type });
    if (error) { setEnvoi(""); return setMsg("Erreur : " + (error.message.includes("Bucket") ? "fais d’abord la mise à jour SQL n°18." : error.message)); }
    const { error: e2 } = await db.rpc("admin_agent_modifier", { adresse: a.email, champs: { [type === "photo" ? "photo_path" : "cni_path"]: chemin } });
    setEnvoi("");
    setMsg(e2 ? "Erreur : " + e2.message : type === "photo" ? "Photo enregistrée." : "Pièce d’identité enregistrée.");
    recharger();
  }
  return (
    <Volet titre={`${a.numero ?? ""} · ${a.nom ?? a.email}`} sousTitre={`${a.role === "fondateur" ? "Co-fondateur" : "Agent service client"} · identifiant de connexion : ${a.numero ?? a.email}`} fermer={fermer}>
      <div className={`flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm ring-1 ${a.role === "fondateur" ? "bg-emerald-50 ring-emerald-200" : "bg-sky-50 ring-sky-200"}`}>
        <span className="flex-1"><b>{a.role === "fondateur" ? "Co-fondateur" : "Agent"}</b> · {a.role === "fondateur" ? "a tous les pouvoirs, comme toi." : "ne peut rien confirmer ni supprimer, il t’envoie des dossiers."}</span>
        <button
          onClick={async () => {
            const vers = a.role === "fondateur" ? "agent" : "fondateur";
            if (!confirm(vers === "fondateur" ? `Nommer ${a.nom ?? a.email} co-fondateur ? Il aura TOUS les pouvoirs : revenus, salaires, suppression des groupes, gestion de l’équipe.` : `Repasser ${a.nom ?? a.email} agent ? Il perdra ses pouvoirs de fondateur.`)) return;
            const { error } = await db.rpc("admin_changer_role", { adresse: a.email, nouveau_role: vers });
            setMsg(error ? "Erreur : " + (error.message.includes("admin_changer_role") ? "fais d’abord la mise à jour SQL n°25." : error.message) : vers === "fondateur" ? "Nommé co-fondateur." : "Repassé agent.");
            recharger();
          }}
          className={`rounded-xl px-3 py-2 text-xs font-bold text-white ${a.role === "fondateur" ? "bg-stone-700" : "bg-emerald-700"}`}
        >
          {a.role === "fondateur" ? "Repasser agent" : "Nommer co-fondateur"}
        </button>
      </div>
      <div className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-stone-200/80">
        <PhotoPrivee chemin={a.photo_path} nom={a.nom ?? a.email} taille={72} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-lg font-extrabold">{a.nom}</p>
          {!!a.fonctions?.length && <p className="text-xs font-semibold text-sky-700">{a.fonctions.join(" · ")}</p>}
          <BadgeCnps ok={a.cnps_declare} />
          <p className="text-xs text-stone-500">{a.salaire ? `${fcfa(a.salaire)} par mois` : "Salaire non renseigné"}{a.embauche_le ? ` · depuis le ${dateCourte(a.embauche_le)}` : ""}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold">
          <Camera size={15} /> {envoi === "photo" ? "Envoi…" : "Photo"}
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => televerser("photo", e.target.files?.[0])} />
        </label>
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      <form onSubmit={enregistrer} className="space-y-4">
        <BlocFiche titre="Identité">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-stone-500">Nom et prénoms<input value={f.nom} onChange={maj("nom")} className={champ} /></label>
            <label className="text-xs font-semibold text-stone-500">Numéro Wave / téléphone<input value={f.telephone} onChange={maj("telephone")} inputMode="tel" className={champ} /></label>
            <label className="text-xs font-semibold text-stone-500">N° de la pièce d’identité (CNI)<input value={f.cni_numero} onChange={maj("cni_numero")} placeholder="ex : CI001234567" className={champ} /></label>
            <label className="text-xs font-semibold text-stone-500">Contact d’urgence<input value={f.contact_urgence} onChange={maj("contact_urgence")} placeholder="Nom et numéro" className={champ} /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {a.cni_path ? <PieceIdentite chemin={a.cni_path} /> : <p className="text-xs text-stone-500">Aucune photo de la pièce d’identité.</p>}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold">
              <IdCard size={15} /> {envoi === "cni" ? "Envoi…" : a.cni_path ? "Remplacer la pièce" : "Ajouter la photo de la pièce"}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => televerser("cni", e.target.files?.[0])} />
            </label>
          </div>
        </BlocFiche>
        <BlocFiche titre={`Fonction(s)${f.fonctions.length ? ` · ${f.fonctions.length}` : ""}`}>
          <ChoixFonctions valeur={f.fonctions} onChange={(v) => setF({ ...f, fonctions: v })} />
        </BlocFiche>
        <BlocFiche titre="Contrat et salaire">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold text-stone-500">Salaire mensuel (F)<input value={f.salaire} onChange={maj("salaire")} inputMode="numeric" className={champ} /></label>
            <label className="text-xs font-semibold text-stone-500">Type de contrat
              <select value={f.contrat} onChange={maj("contrat")} className={champ}>
                <option value="">—</option>{["CDI", "CDD", "Stage", "Prestataire"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-stone-500">Date d’embauche<input type="date" value={f.embauche_le} onChange={maj("embauche_le")} className={champ} /></label>
          </div>
        </BlocFiche>
        <BlocFiche titre="Déclaration CNPS">
          <button type="button" onClick={() => setF({ ...f, cnps_declare: !f.cnps_declare })} className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${f.cnps_declare ? "border-emerald-500 bg-emerald-50" : "border-red-300 bg-red-50"}`}>
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${f.cnps_declare ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{f.cnps_declare ? <BadgeCheck size={20} /> : <ShieldX size={20} />}</span>
            <span className="flex-1">
              <span className={`block font-bold ${f.cnps_declare ? "text-emerald-800" : "text-red-700"}`}>{f.cnps_declare ? "Déclaré à la CNPS" : "Pas encore déclaré à la CNPS"}</span>
              <span className="text-xs text-stone-600">Touche pour changer</span>
            </span>
          </button>
          {f.cnps_declare && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-xs font-semibold text-stone-500">N° d’immatriculation CNPS<input value={f.cnps_numero} onChange={maj("cnps_numero")} className={champ} /></label>
              <label className="text-xs font-semibold text-stone-500">Déclaré le<input type="date" value={f.cnps_le} onChange={maj("cnps_le")} className={champ} /></label>
            </div>
          )}
        </BlocFiche>
        <BlocFiche titre="Notes">
          <textarea value={f.note} onChange={maj("note")} rows={3} placeholder="Remarques, absences, points à suivre…" className={`${champ} resize-y`} />
        </BlocFiche>
        <button className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white">Enregistrer le dossier</button>
      </form>
      {a.role === "agent" && <button onClick={retirer} className="w-full rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600 hover:bg-red-50">Retirer cet agent</button>}
    </Volet>
  );
}

function PieceIdentite({ chemin }: { chemin: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { db.storage.from("agents").createSignedUrl(chemin, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [chemin]);
  if (!url) return <span className="text-xs text-stone-400">Chargement…</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Pièce d’identité" className="h-20 rounded-lg object-cover ring-1 ring-stone-200" /></a>;
}

function Salaires() {
  const [mois, setMois] = useState(() => new Date().toISOString().slice(0, 7));
  const [liste, setListe] = useState<Salaire[] | null>(null);
  const [msg, setMsg] = useState("");
  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_salaires", { m: mois });
    setListe(error ? null : ((data as Salaire[]) ?? []));
  }, [mois]);
  useEffect(() => { charger(); }, [charger]);
  if (liste === null) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour les salaires, fais d’abord la <b>mise à jour SQL n°18</b> dans Supabase.</p>;
  const aPayer = liste.filter((a) => !a.paye && a.salaire);
  const total = aPayer.reduce((t, a) => t + (a.salaire ?? 0), 0);
  const nomMois = new Date(mois + "-15").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const payer = async (a: Salaire) => {
    const ref = prompt(`Salaire de ${a.nom} pour ${nomMois} : ${fcfa(a.salaire ?? 0)}.\n\nEnvoie l’argent par Wave au ${a.telephone ? telAffiche(a.telephone) : "(numéro non renseigné)"}, puis colle ici la référence de la transaction (facultatif) :`);
    if (ref === null) return;
    const { error } = await db.rpc("admin_salaire_payer", { adresse: a.email, m: mois, montant: a.salaire, ref: ref || null });
    setMsg(error ? "Erreur : " + error.message : `Salaire de ${a.nom} marqué payé.`);
    charger();
  };
  const fichierWave = () => {
    const lignes = [["Nom", "Numero", "Montant", "Motif"], ...aPayer.map((a) => [a.nom ?? "", a.telephone ? "+225" + a.telephone.slice(-10) : "", String(a.salaire ?? 0), `Salaire ${nomMois} Cotiz`])];
    const csv = lignes.map((l) => l.map((x) => `"${x.replace(/"/g, '""')}"`).join(";")).join("\n");
    const lien = document.createElement("a");
    lien.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    lien.download = `cotiz-salaires-${mois}.csv`;
    lien.click();
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input type="month" value={mois} onChange={(e) => setMois(e.target.value)} className={`${champ} !w-auto`} />
        <p className="flex-1 text-sm text-stone-600">Reste à payer pour <b>{nomMois}</b> : <b className="text-emerald-800">{fcfa(total)}</b> ({aPayer.length} agent{aPayer.length > 1 ? "s" : ""})</p>
        <button onClick={fichierWave} disabled={aPayer.length === 0} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1dc8f2] px-4 py-2.5 text-sm font-bold text-stone-900 shadow-sm disabled:opacity-40"><Download size={16} /> Fichier de paiement Wave</button>
      </div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <b>Payer tout le monde d’un coup :</b> télécharge le fichier ci-dessus et dépose-le sur <b>Wave Business → Paiements en masse</b>. Le paiement direct depuis Cotiz arrivera quand Cotiz aura l’accès API Wave (compte entreprise). En attendant, paie chaque agent par Wave puis touche <b>« Marquer payé »</b>.
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      {liste.some((a) => a.salaire) && (
        <div className="grid gap-4 md:grid-cols-2">
          <Bloc titre="Masse salariale du mois">
            <Anneau parts={[{ label: "Déjà payé", n: liste.filter((a) => a.paye).reduce((t, a) => t + (a.salaire ?? 0), 0), couleur: VERT }, { label: "Reste à payer", n: total, couleur: ORANGE }]} format={fcfa} sousCentre="au total" />
          </Bloc>
          <Bloc titre="Agents payés">
            <Montre pourcent={Math.round((liste.filter((a) => a.paye).length / Math.max(1, liste.filter((a) => a.salaire).length)) * 100)} label="de l’équipe est payée" sous={`${liste.filter((a) => a.paye).length} sur ${liste.filter((a) => a.salaire).length} agents`} />
          </Bloc>
        </div>
      )}
      <Bloc titre={`Salaires de ${nomMois}`}>
        {liste.length === 0 ? <p className="text-sm text-stone-500">Aucun agent.</p> : (
          <Liste>
            {liste.map((a) => (
              <div key={a.email} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="rounded-md bg-stone-900 px-1.5 py-0.5 font-mono text-[0.7rem] text-white">{a.numero ?? "—"}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.nom}</p>
                  <p className="text-xs text-stone-500">{a.telephone ? <a href={`tel:${a.telephone}`} className="inline-flex items-center gap-1 text-emerald-700 underline"><Phone size={11} />{telAffiche(a.telephone)}</a> : "numéro Wave manquant"} · <BadgeCnps ok={a.cnps_declare} /></p>
                </div>
                <b className="shrink-0">{a.salaire ? fcfa(a.salaire) : "—"}</b>
                {a.paye ? (
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">✓ Payé le {a.paye_le ? dateCourte(a.paye_le) : ""}{a.reference ? ` · ${a.reference}` : ""}</span>
                    <button onClick={async () => { if (!confirm("Annuler ce paiement ?")) return; await db.rpc("admin_salaire_annuler", { adresse: a.email, m: mois }); charger(); }} className="text-xs text-stone-400 underline">annuler</button>
                  </span>
                ) : (
                  <button disabled={!a.salaire} onClick={() => payer(a)} className="shrink-0 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40">Marquer payé</button>
                )}
              </div>
            ))}
          </Liste>
        )}
      </Bloc>
    </>
  );
}

type Revenus = { total: number; frais?: number; penalites?: number; nb: number; volume: number; depuis_debut: number; par_jour: { jour: string; montant: number; nb: number }[]; par_groupe: { groupe: string; montant: number; nb: number }[] };

function Revenus() {
  const [periode, setPeriode] = useState<"mois" | "30j" | "annee">("mois");
  const [r, setR] = useState<Revenus | null | undefined>(undefined);
  const [tranches, setTranches] = useState<Tranche[]>(TRANCHES_DEFAUT);
  const [actif, setActif] = useState(true);
  const [pourcent, setPourcent] = useState("0");
  const [tranchesPen, setTranchesPen] = useState<TranchePenalite[]>([{ max: null, part: 50 }]);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);
  const bornes = () => {
    const a = new Date(); const d = new Date();
    if (periode === "mois") d.setDate(1); else if (periode === "30j") d.setDate(d.getDate() - 29); else { d.setMonth(0); d.setDate(1); }
    return { du: iso(d), au: iso(a) };
  };
  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_revenus", bornes());
    setR(error ? null : (data as Revenus));
    const p = await db.from("parametres_app").select("cle, valeur").like("cle", "frais_service_%");
    const v = Object.fromEntries((p.data ?? []).map((x: { cle: string; valeur: string | null }) => [x.cle, x.valeur]));
    setTranches(lireTranches(v.frais_service_tranches));
    setActif(v.frais_service_actif !== "non");
    setPourcent(String(lirePourcent(v.frais_service_pourcent)).replace(".", ","));
    { const t = lireTranchesPenalite(v.frais_service_penalite_tranches, v.frais_service_part_penalite); setTranchesPen([{ max: null, part: t[t.length - 1]?.part ?? 50 }]); }
  }, [periode]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { charger(); }, [charger]);

  if (r === undefined) return <p className="text-sm text-stone-500">Chargement…</p>;
  if (r === null) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour voir tes revenus et régler les frais, fais d’abord la <b>mise à jour SQL n°23</b> dans Supabase (fichier <code>migration-23-frais-service.sql</code>).</p>;

  const enregistrer = async (nouvelActif = actif) => {
    const propres = tranches.map((t) => ({ max: t.max, frais: Math.max(0, Math.round(t.frais || 0)) }));
    const plafonds = propres.filter((t) => t.max !== null).map((t) => t.max!);
    if (plafonds.some((m, k) => k > 0 && m <= plafonds[k - 1])) return setMsg("Erreur : les plafonds doivent aller en augmentant.");
    if (propres[propres.length - 1].max !== null) return setMsg("Erreur : la dernière tranche doit être « au-delà ».");
    setOccupe(true); setMsg("");
    const a = await db.rpc("admin_parametre", { c: "frais_service_tranches", v: JSON.stringify(propres) });
    const b = await db.rpc("admin_parametre", { c: "frais_service_actif", v: nouvelActif ? "oui" : "non" });
    const pc = Number(pourcent.replace(",", ".")) || 0;
    const c = pc >= 0 && pc <= 10 ? await db.rpc("admin_parametre", { c: "frais_service_pourcent", v: String(pc) }) : { error: { message: "le pourcentage doit être entre 0 et 10 %" } };
    setOccupe(false);
    const tp = tranchesPen.map((t) => ({ max: t.max, part: Math.min(100, Math.max(0, Math.round(t.part || 0))) }));
    const plafP = tp.filter((t) => t.max !== null).map((t) => t.max!);
    if (plafP.some((m, k) => k > 0 && m <= plafP[k - 1]) || tp[tp.length - 1].max !== null) { setOccupe(false); setMsg("Erreur : tranches de pénalités mal rangées (plafonds croissants, la dernière « au-delà »)."); return; }
    const d = await db.rpc("admin_parametre", { c: "frais_service_penalite_tranches", v: JSON.stringify(tp) });
    if (!d.error) await db.rpc("admin_parametre", { c: "frais_service_part_penalite", v: String(tp[tp.length - 1].part) });
    if (d.error && !c.error) { setOccupe(false); setMsg("Erreur : " + (d.error.message.includes("inconnu") ? "fais la mise à jour SQL n°28 pour les tranches de pénalités" : d.error.message)); return; }
    const e = a.error ?? b.error ?? (c.error ? { message: c.error.message.includes("inconnu") ? "fais la mise à jour SQL n°24 pour le pourcentage" : c.error.message } : null);
    setMsg(e ? "Erreur : " + e.message : nouvelActif ? "Frais enregistrés : ils s’appliquent dès maintenant aux paiements en ligne." : "Frais de service désactivés : les paiements en ligne sont sans frais Cotiz.");
    if (!e) setActif(nouvelActif);
  };
  const maj = (k: number, champ: "max" | "frais", v: string) => setTranches(tranches.map((t, j) => (j === k ? { ...t, [champ]: v === "" ? (champ === "max" ? null : 0) : Number(v.replace(/\D/g, "")) } : t)));
  const exemples = [1000, 5000, 10000, 25000, 50000, 100000];
  const pct = r.volume ? ((r.total / r.volume) * 100).toFixed(1).replace(".", ",") : "0";

  return (
    <>
      <div className="flex flex-wrap gap-1.5">
        {([["mois", "Ce mois-ci"], ["30j", "30 derniers jours"], ["annee", "Cette année"]] as const).map(([id, l]) => (
          <button key={id} onClick={() => setPeriode(id)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${periode === id ? "border-stone-900 bg-stone-900 text-white" : "border-stone-200 bg-white text-stone-600"}`}>{l}</button>
        ))}
      </div>
      <div className="degrade-vert relative overflow-hidden rounded-3xl p-5 text-white shadow-lg">
        <div className="motif pointer-events-none absolute inset-0 opacity-25" />
        <div className="balaie pointer-events-none absolute inset-y-0 left-0" />
        <div className="halo pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-orange-400/25 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-emerald-50/90">Ce que Cotiz a gagné · {periode === "mois" ? "ce mois-ci" : periode === "30j" ? "30 derniers jours" : "cette année"}</p>
            <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight lg:text-5xl"><TexteAnime texte={fcfa(r.total)} /></p>
            <p className="mt-1 text-sm text-emerald-50/90">{r.nb} paiement{r.nb > 1 ? "s" : ""} en ligne · {fcfa(r.depuis_debut)} depuis le début</p>
          </div>
          <span className="flotte rounded-2xl bg-orange-500 px-4 py-2 text-sm font-extrabold shadow-lg shadow-orange-900/30">{pct} % du volume</span>
        </div>
        <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Mes revenus" valeur={fcfa(r.total)} detail={r.penalites ? `frais ${fcfa(r.frais ?? 0)} + pénalités ${fcfa(r.penalites)}` : `${r.nb} paiement${r.nb > 1 ? "s" : ""} en ligne`} icone={Coins} ton="amber" />
        <Chiffre label="Argent passé en ligne" valeur={fcfa(r.volume)} detail={`soit ${pct} % pour Cotiz`} icone={Wallet} ton="emerald" />
        <Chiffre label="Moyenne par paiement" valeur={fcfa(r.nb ? Math.round(r.total / r.nb) : 0)} detail="frais de service" icone={BarChart3} ton="sky" />
        <Chiffre label="Depuis le début" valeur={fcfa(r.depuis_debut)} detail="total gagné" icone={BadgeCheck} ton="violet" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Revenus jour par jour" sous="Frais de service des paiements en ligne confirmés" className="lg:col-span-2">
          {r.par_jour.length === 0 ? <p className="text-sm text-stone-500">Aucun revenu sur cette période. Les frais s’appliquent seulement aux paiements en ligne (GeniusPay / Wave).</p> : (
            <Courbe points={r.par_jour.map((j) => ({ label: dateCourte(j.jour), n: j.montant }))} couleur={ORANGE} format={fcfa} />
          )}
        </Bloc>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc titre="D’où vient l’argent" sous="Frais de service ou part des pénalités">
          <Anneau parts={[{ label: "Frais de service", n: r.frais ?? r.total - (r.penalites ?? 0), couleur: VERT }, { label: "Part des pénalités", n: r.penalites ?? 0, couleur: ORANGE }]} format={fcfa} sousCentre="gagnés" />
        </Bloc>
        <Bloc titre="Ta part sur l’argent passé" sous={`${fcfa(r.total)} sur ${fcfa(r.volume)}`}>
          <Jauge valeur={Number(pct.replace(",", "."))} max={5} unite="%" label="pour Cotiz" format={(n) => `${String(n).replace(".", ",")} %`} />
        </Bloc>
        <Bloc titre="Groupes qui te rapportent le plus">
          {r.par_groupe.length === 0 ? <p className="text-sm text-stone-500">Rien pour l’instant.</p> : (
            <Barres lignes={r.par_groupe.map((g) => ({ label: `${g.groupe} (${g.nb})`, n: g.montant, couleur: ORANGE }))} format={fcfa} />
          )}
        </Bloc>
      </div>
      <Bloc titre="Frais de service Cotiz" sous="Payés par le membre en plus de sa cotisation, seulement pour un paiement en ligne. Le paiement manuel au trésorier reste gratuit."
        action={<button onClick={() => enregistrer(!actif)} disabled={occupe} className={`rounded-full px-3 py-1.5 text-xs font-bold ${actif ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-600"}`}>{actif ? "● Activés" : "○ Désactivés"}</button>}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Pliable titre="Frais par paiement" resume={`${tranches.map((t) => t.frais).join(" / ")} F${Number(pourcent.replace(",", ".")) ? ` + ${pourcent} %` : ""}`} ton="ambre">
            {tranches.map((t, k) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-stone-500">{k === 0 ? "De 0 F" : `De ${fcfa(tranches[k - 1].max ?? 0)}`}</span>
                <span className="shrink-0 text-stone-500">à</span>
                {t.max === null ? <span className="w-28 shrink-0 rounded-xl bg-stone-50 px-3 py-2.5 text-right text-stone-500">au-delà</span> : (
                  <input value={t.max} onChange={(e) => maj(k, "max", e.target.value)} inputMode="numeric" className={`${champ} !w-28 shrink-0 text-right`} aria-label="Plafond de la tranche" />
                )}
                <span className="shrink-0 text-stone-500">→</span>
                <input value={t.frais} onChange={(e) => maj(k, "frais", e.target.value)} inputMode="numeric" className={`${champ} !w-20 shrink-0 text-right font-bold text-amber-700`} aria-label="Frais en F" />
                <span className="shrink-0 font-semibold">F</span>
                {tranches.length > 1 && t.max !== null && <button onClick={() => setTranches(tranches.filter((_, j) => j !== k))} className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" aria-label="Supprimer la tranche"><Trash2 size={15} /></button>}
              </div>
            ))}
            <button onClick={() => { const der = tranches[tranches.length - 1]; const avant = tranches.slice(0, -1); const plafond = (avant[avant.length - 1]?.max ?? 0) + 10000; setTranches([...avant, { max: plafond, frais: der.frais }, der]); }} className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Plus size={14} /> Ajouter une tranche de frais</button>
            <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <span className="flex-1 font-semibold text-amber-900">En plus : un pourcentage du montant</span>
              <input value={pourcent} onChange={(e) => setPourcent(e.target.value.replace(/[^\d,.]/g, "").slice(0, 4))} inputMode="decimal" className={`${champ} !w-20 text-right font-bold text-amber-700`} aria-label="Pourcentage en plus" />
              <span className="font-semibold">%</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {["0", "0,5", "1", "1,5", "2"].map((x) => (
                <button key={x} onClick={() => setPourcent(x)} className={`rounded-full border px-2.5 py-1 text-xs font-bold ${pourcent === x ? "border-amber-600 bg-amber-600 text-white" : "border-stone-200 bg-white text-stone-600"}`}>{x} %</button>
              ))}
              <span className="self-center text-xs text-stone-500">0 % = seulement les montants fixes · 10 % maximum</span>
            </div>
            </Pliable>
            <Pliable titre="Part de Cotiz sur les pénalités" resume={`${tranchesPen[tranchesPen.length - 1]?.part ?? 0} % Cotiz · ${100 - (tranchesPen[tranchesPen.length - 1]?.part ?? 0)} % groupe`} ton="rouge">
              <p className="text-xs text-stone-600">Un seul réglage pour toute l’application. Le reste va à la caisse du groupe · paiements en ligne seulement.</p>
              <div className="flex flex-wrap gap-1.5">
                {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((n) => {
                  const actuel = tranchesPen[tranchesPen.length - 1]?.part ?? 0;
                  return (
                    <button key={n} type="button" onClick={() => setTranchesPen([{ max: null, part: n }])}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${actuel === n && tranchesPen.length === 1 ? "border-red-600 bg-red-600 text-white" : "border-stone-200 bg-white text-stone-700"}`}>
                      {n} %
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-stone-600">Choisi : <b className="text-red-700">{tranchesPen[tranchesPen.length - 1]?.part ?? 0} % pour Cotiz</b>, {100 - (tranchesPen[tranchesPen.length - 1]?.part ?? 0)} % pour le groupe. Exemple : pénalité de 1 000 F → Cotiz {fcfa(partCotizPenalite(1000, [{ max: null, part: tranchesPen[tranchesPen.length - 1]?.part ?? 0 }]))}, groupe {fcfa(1000 - partCotizPenalite(1000, [{ max: null, part: tranchesPen[tranchesPen.length - 1]?.part ?? 0 }]))}.</p>
            </Pliable>

            <Pliable titre="Offre spéciale sur une période" resume="1 à 3 mois, avec annonce automatique" ton="orange">
              <OffrePenalite partHabituelle={tranchesPen[tranchesPen.length - 1]?.part ?? 50} />
            </Pliable>

            <div className="flex gap-2 pt-2">
              <button disabled={occupe} onClick={() => enregistrer()} className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{occupe ? "…" : "Enregistrer les frais"}</button>
              <button onClick={() => setTranches(TRANCHES_DEFAUT)} className="rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-bold text-stone-700">Par défaut</button>
            </div>
            {msg && <p className={`text-sm font-medium ${msg.startsWith("Erreur") ? "text-red-600" : "text-emerald-800"}`}>{msg}</p>}
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-500">Ce que paie le membre</p>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-stone-500"><tr><th className="py-1">Cotisation</th><th className="text-right">Frais Cotiz</th><th className="text-right">Soit</th></tr></thead>
              <tbody className="divide-y divide-stone-100">
                {exemples.map((m) => { const f = actif ? fraisPour(m, tranches, Number(pourcent.replace(",", ".")) || 0) : 0; return (
                  <tr key={m}><td className="py-1.5">{fcfa(m)}</td><td className="text-right font-bold text-amber-700">{fcfa(f)}</td><td className="text-right text-stone-500">{((f / m) * 100).toFixed(1).replace(".", ",")} %</td></tr>
                ); })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-stone-500">À cela s’ajoutent les frais de l’opérateur (GeniusPay ≈ 2,5 % + 100 F), payés aussi par le membre. Dans l’application, le membre voit seulement le montant total ; le détail figure sur son reçu.</p>
          </div>
        </div>
      </Bloc>
    </>
  );
}

/** Bloc pliable : on voit le titre et un résumé, on touche pour ouvrir */
function Pliable({ titre, resume, ton, children }: { titre: string; resume?: string; ton: "ambre" | "rouge" | "orange"; children: React.ReactNode }) {
  const c = { ambre: "border-amber-200 bg-amber-50/50 text-amber-900", rouge: "border-red-200 bg-red-50/50 text-red-900", orange: "border-orange-200 bg-orange-50/60 text-orange-900" }[ton];
  return (
    <details className={`group rounded-2xl border ${c} [&_summary::-webkit-details-marker]:hidden`}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{titre}</span>
          {resume && <span className="block truncate text-xs text-stone-600">{resume}</span>}
        </span>
        <ChevronDown size={18} className="shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-2 border-t border-black/5 p-3 text-sm text-stone-900">{children}</div>
    </details>
  );
}

/** Offre spéciale : une autre part des pénalités pendant 1, 2 ou 3 mois, avec annonce automatique */
function OffrePenalite({ partHabituelle }: { partHabituelle: number }) {
  const [offre, setOffre] = useState<{ part: number; fin: string | null } | null>(null);
  const [part, setPart] = useState(40);
  const [mois, setMois] = useState(1);
  const [publier, setPublier] = useState(true);
  const [notifier, setNotifier] = useState(false);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);
  const charger = useCallback(async () => {
    const { data } = await db.from("parametres_app").select("cle, valeur").like("cle", "frais_service_promo_%");
    const v = Object.fromEntries((data ?? []).map((x: { cle: string; valeur: string | null }) => [x.cle, x.valeur]));
    const fin = v.frais_service_promo_fin && new Date(v.frais_service_promo_fin).getTime() > Date.now() ? v.frais_service_promo_fin : null;
    setOffre({ part: Number(v.frais_service_promo_part ?? 40), fin });
  }, []);
  useEffect(() => { charger(); }, [charger]);
  const lancer = async () => {
    const dateFin = new Date(); dateFin.setMonth(dateFin.getMonth() + mois);
    if (!confirm(`Lancer l’offre : ${part} % pour Cotiz et ${100 - part} % pour le groupe, jusqu’au ${dateFin.toLocaleDateString("fr-FR")} ?${publier ? "\n\nUne annonce sera publiée sur l’accueil de tout le monde." : ""}${notifier ? "\nTous les inscrits recevront une notification." : ""}`)) return;
    setOccupe(true); setMsg("");
    const { data, error } = await db.rpc("admin_offre_penalite", { part, mois, publier, notifier });
    setOccupe(false);
    if (error) return setMsg("Erreur : " + (/admin_offre_penalite|schema cache/i.test(error.message) ? "fais d’abord la mise à jour SQL n°29." : error.message));
    const r = data as { notifications: number };
    setMsg(`Offre lancée.${publier ? " L’annonce est sur l’accueil." : ""}${r.notifications ? ` ${r.notifications} notification(s) envoyée(s).` : ""}`);
    charger();
  };
  const arreter = async () => {
    if (!confirm("Arrêter l’offre maintenant ? La part habituelle reviendra et l’annonce disparaîtra.")) return;
    const { error } = await db.rpc("admin_offre_penalite_arreter");
    setMsg(error ? "Erreur : " + error.message : "Offre arrêtée.");
    charger();
  };
  return (
    <div className="space-y-2.5">
      <p><span className="text-xs text-stone-600">Pendant la période, cette part remplace la part habituelle ({partHabituelle} % pour Cotiz). Elle revient toute seule à la fin.</span></p>
      {offre?.fin && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2.5 ring-1 ring-orange-200">
          <span className="flex-1"><b className="text-orange-800">Offre en cours :</b> {offre.part} % Cotiz · {100 - offre.part} % groupe, jusqu’au <b>{new Date(offre.fin).toLocaleDateString("fr-FR")}</b></span>
          <button onClick={arreter} className="rounded-lg border border-stone-200 px-2.5 py-1 text-xs font-bold text-stone-700">Arrêter</button>
        </div>
      )}
      <div>
        <p className="mb-1 text-xs font-semibold text-stone-600">Part de Cotiz pendant l’offre</p>
        <div className="flex flex-wrap gap-1.5">
          {[0, 10, 20, 30, 40, 50, 60].map((n) => (
            <button key={n} type="button" onClick={() => setPart(n)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${part === n ? "border-orange-600 bg-orange-600 text-white" : "border-stone-200 bg-white text-stone-700"}`}>{n} %</button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold text-stone-600">Durée</p>
        <div className="flex gap-1.5">
          {[1, 2, 3].map((n) => (
            <button key={n} type="button" onClick={() => setMois(n)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${mois === n ? "border-orange-600 bg-orange-600 text-white" : "border-stone-200 bg-white text-stone-700"}`}>{n} mois</button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={publier} onChange={(e) => setPublier(e.target.checked)} className="h-4 w-4 accent-orange-600" /> Publier une annonce sur l’accueil de l’application</label>
      <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={notifier} onChange={(e) => setNotifier(e.target.checked)} className="h-4 w-4 accent-orange-600" /> Prévenir aussi tous les inscrits par notification</label>
      <div className="rounded-xl bg-white p-2.5 text-xs text-stone-700 ring-1 ring-orange-100">
        <b>Aperçu de l’annonce :</b> « Offre spéciale : {100 - part} % des pénalités pour votre groupe. Jusqu’au {(() => { const d = new Date(); d.setMonth(d.getMonth() + mois); return d.toLocaleDateString("fr-FR"); })()}, {100 - part} % des pénalités payées en ligne restent dans la caisse de votre groupe. »
      </div>
      <button disabled={occupe} onClick={lancer} className="w-full rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{occupe ? "…" : offre?.fin ? "Remplacer l’offre en cours" : "Lancer l’offre"}</button>
      {msg && <p className={`text-xs font-medium ${msg.startsWith("Erreur") ? "text-red-600" : "text-emerald-800"}`}>{msg}</p>}
    </div>
  );
}

function Volet({ titre, sousTitre, fermer, children }: { titre: string; sousTitre?: string; fermer: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-stone-900/40" onClick={fermer}>
      <div className="feuille-droite flex h-full w-full max-w-2xl flex-col bg-[#f7f5f0] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-stone-200 bg-white px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-extrabold">{titre}</p>
            {sousTitre && <p className="truncate text-xs text-stone-500">{sousTitre}</p>}
          </div>
          <button onClick={fermer} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600" aria-label="Fermer"><X size={18} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

const BlocFiche = ({ titre, children, action }: { titre: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="rounded-2xl border border-stone-200/80 bg-white p-4">
    <div className="mb-2 flex items-center justify-between gap-2"><p className="font-bold">{titre}</p>{action}</div>
    {children}
  </section>
);

function Identifiant({ id }: { id: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(id); setCopie(true); setTimeout(() => setCopie(false), 1500); }} className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 font-mono text-[0.7rem] text-stone-600" title="Copier l’identifiant">
      <Copy size={11} /> {copie ? "copié !" : id}
    </button>
  );
}

function FicheUtilisateur({ id, fermer, ouvrirGroupe, recharger }: { id: string; fermer: () => void; ouvrirGroupe: (id: string) => void; recharger: () => void }) {
  const { fondateur, demander } = useContext(AdminCtx);
  const [f, setF] = useState<FicheU | null>(null);
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ nom: "", tel: "", naissance: "" });

  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_utilisateur", { p: id });
    if (error) return setErreur(error.message.includes("admin_utilisateur") ? "Lance d’abord la mise à jour SQL n°14." : error.message);
    const d = data as FicheU;
    setF(d);
    if (d.profil) setForm({ nom: d.profil.name, tel: d.profil.phone, naissance: d.profil.date_naissance ?? "" });
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  const action = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setMsg("");
    const { error } = await fn();
    setMsg(error ? "Erreur : " + error.message : ok);
    await charger();
    recharger();
  };

  const bannir = async (bannir: boolean) => {
    const { data } = await db.auth.getSession();
    await fetch("/api/admin/bannir", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` }, body: JSON.stringify({ profileId: id, bannir }) }).catch(() => null);
  };

  const p = f?.profil;
  return (
    <Volet titre={p ? p.name : "Utilisateur"} sousTitre={p ? `${telAffiche(p.phone)} · inscrit le ${dateCourte(p.created_at)}` : undefined} fermer={fermer}>
      {erreur && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {!f && !erreur && <p className="text-sm text-stone-500">Chargement…</p>}
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
      {f && !p && <p className="text-sm text-stone-500">Ce compte n’existe plus.</p>}
      {p && (
        <>
          {p.bloque && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p className="flex items-center gap-2 font-bold"><Ban size={16} /> Compte bloqué {p.bloque_le ? `le ${dateCourte(p.bloque_le)}` : ""}</p>
              {p.bloque_motif && <p className="mt-1">Motif : {p.bloque_motif}</p>}
            </div>
          )}

          <BlocFiche titre="Identité">
            <div className="space-y-1 text-sm">
              <p>Identifiant : <Identifiant id={p.id} /></p>
              <p>Compte : {f.compte?.email?.startsWith("compte-") ? "retrouvé sur un nouveau téléphone" : f.compte?.is_anonymous === false ? f.compte?.email : "créé dans l’application"}</p>
              {f.compte?.last_sign_in_at && <p>Dernière connexion : {dateCourte(f.compte.last_sign_in_at)}</p>}
            </div>
            <form
              className="mt-3 grid gap-2 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!fondateur) {
                  demander({ motif: "Modifier nom / numéro / date de naissance", client_profile_id: id, client_nom: p!.name, client_tel: p!.phone,
                    donnees: { action: "modifier_profil", profile_id: id, nom: form.nom, telephone: form.tel, naissance: form.naissance },
                    resume: `Nouvelles informations : ${form.nom} · ${form.tel} · ${form.naissance ? dateCourte(form.naissance) : "—"}` });
                  return;
                }
                action(async () => await db.rpc("admin_modifier_profil", { p: id, nom: form.nom, telephone: form.tel, naissance: form.naissance || null }), "Informations modifiées.");
              }}
            >
              <label className="text-xs font-semibold text-stone-500">Nom<input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={champ} /></label>
              <label className="text-xs font-semibold text-stone-500">Téléphone<input value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} inputMode="tel" className={champ} /></label>
              <label className="text-xs font-semibold text-stone-500">Naissance<DateNaissance value={form.naissance} onChange={(v) => setForm((x) => ({ ...x, naissance: v }))} /></label>
              <button className={`rounded-xl py-2.5 text-sm font-bold text-white sm:col-span-3 ${fondateur ? "bg-emerald-700" : "bg-violet-700"}`}>{fondateur ? "Enregistrer les modifications" : "Demander la modification au fondateur"}</button>
            </form>
          </BlocFiche>

          <BlocFiche titre="Sécurité">
            <p className="text-sm">Code secret : {f.code?.defini ? <b className="text-emerald-700">créé</b> : <b className="text-stone-500">pas encore créé</b>}{f.code?.modifie_le && ` · modifié le ${dateCourte(f.code.modifie_le)}`}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => confirm("Réinitialiser son code secret ? La personne en créera un nouveau à sa prochaine ouverture.") && action(async () => await db.rpc("admin_reinitialiser_code_profil", { p: id }), "Code réinitialisé.")} className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold">
                <KeyRound size={15} className="mr-1 inline" /> Réinitialiser le code
              </button>
              {!fondateur ? (
                <button onClick={() => demander({ motif: p.bloque ? "Débloquer un compte" : "Bloquer un compte", client_profile_id: id, client_nom: p.name, client_tel: p.phone, donnees: { action: p.bloque ? "debloquer" : "bloquer", profile_id: id }, resume: `${p.bloque ? "Débloquer" : "Bloquer à vie"} le compte de ${p.name}` })} className="inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-sm font-bold text-white">
                  <Send size={15} /> {p.bloque ? "Demander le déblocage" : "Demander le blocage"}
                </button>
              ) : p.bloque ? (
                <button onClick={() => confirm(`Débloquer ${p.name} ?`) && action(async () => { const r = await db.rpc("admin_bloquer", { p: id, bloquer: false }); await bannir(false); return r; }, "Compte débloqué.")} className="rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white">
                  Débloquer
                </button>
              ) : (
                <button
                  onClick={() => {
                    const motif = prompt(`Bloquer ${p.name} À VIE ? Il ne pourra plus rien faire sur Cotiz, ni recréer un compte avec ce numéro.\n\nMotif (facultatif) :`);
                    if (motif === null) return;
                    action(async () => { const r = await db.rpc("admin_bloquer", { p: id, bloquer: true, motif }); await bannir(true); return r; }, "Compte bloqué à vie.");
                  }}
                  className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white"
                >
                  <Ban size={15} className="mr-1 inline" /> Bloquer à vie
                </button>
              )}
            </div>
            {f.historique_code.length > 0 && <p className="mt-3 text-xs text-stone-500">Historique du code : {f.historique_code.slice(0, 6).map((h) => `${h.action} (${dateCourte(h.le)})`).join(" · ")}</p>}
            {f.tentatives.length > 0 && <p className="mt-1 text-xs text-stone-500">Connexions sur un autre téléphone : {f.tentatives.filter((t) => t.reussie).length} réussie(s), {f.tentatives.filter((t) => !t.reussie).length} échouée(s)</p>}
          </BlocFiche>

          <BlocFiche titre="Supprimer le compte">
            <p className="text-sm text-stone-600"><b>Bloquer</b> : la personne ne peut plus rien faire, et son numéro ne peut plus jamais se réinscrire. <b>Supprimer</b> : son compte et ses données personnelles sont effacés, et son numéro pourra se réinscrire plus tard. Ses paiements déjà faits restent dans les groupes (preuves), et les groupes qu’elle a créés passent au trésorier, ou sont effacés si elle était seule.</p>
            {fondateur ? (
              <button
                onClick={async () => {
                  const saisie = prompt(`Supprimer DÉFINITIVEMENT le compte de ${p.name} (${telAffiche(p.phone)}) ? Rien ne pourra être récupéré.\n\nPour confirmer, écris : SUPPRIMER`);
                  if (saisie === null) return;
                  if (saisie.trim().toUpperCase() !== "SUPPRIMER") { alert("Confirmation incorrecte (il faut écrire SUPPRIMER) : rien n’a été supprimé."); return; }
                  const { data, error } = await db.rpc("admin_supprimer_compte", { p: id });
                  if (error) {
                    const texte = /admin_supprimer_compte|schema cache|Could not find the function/i.test(error.message)
                      ? "La suppression n’est pas encore installée : lance d’abord la mise à jour SQL n°26 dans Supabase."
                      : "La suppression a échoué : " + error.message;
                    setMsg("Erreur : " + texte);
                    alert(texte);
                    return;
                  }
                  const r = data as { groupes_supprimes: number; groupes_confies: number; places_gardees: number };
                  alert(`Compte supprimé.\n${r.groupes_supprimes} groupe(s) effacé(s), ${r.groupes_confies} groupe(s) confié(s) au trésorier, ${r.places_gardees} place(s) gardée(s) pour l’historique des paiements.`);
                  recharger();
                  fermer();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100"
              >
                <Trash2 size={15} /> Supprimer définitivement ce compte
              </button>
            ) : (
              <button onClick={() => demander({ motif: "Supprimer un compte", client_profile_id: id, client_nom: p.name, client_tel: p.phone, donnees: { action: "supprimer_compte", profile_id: id }, resume: `Supprimer définitivement le compte de ${p.name}` })} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-700 px-3 py-2 text-sm font-bold text-white"><Send size={15} /> Demander la suppression au fondateur</button>
            )}
          </BlocFiche>

          {!fondateur && (
            <button onClick={() => demander({ client_profile_id: id, client_nom: p.name, client_tel: p.phone })} className="flex w-full items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-3 text-sm font-bold text-violet-800">
              <Send size={16} /> Ouvrir un dossier pour {p.name}
            </button>
          )}

          <BlocFiche titre={`Groupes (${f.groupes.length})`}>
            {f.groupes.length === 0 ? <p className="text-sm text-stone-500">Aucun groupe.</p> : (
              <Liste>
                {f.groupes.map((g) => (
                  <button key={g.membre_id} onClick={() => ouvrirGroupe(g.id)} className="flex w-full items-center gap-2 py-2.5 text-left text-sm hover:bg-stone-50">
                    <span className="min-w-0 flex-1 truncate font-semibold">{g.name}</span>
                    <span className="text-xs text-stone-500">{g.createur ? "Créateur" : ROLE[g.role] ?? g.role}{g.en_attente ? " · en attente" : ""}{g.archive ? " · parti" : ""}</span>
                    <ChevronRight size={15} className="text-stone-400" />
                  </button>
                ))}
              </Liste>
            )}
          </BlocFiche>

          <BlocFiche titre={`Paiements (${f.paiements.length})`}>
            {f.paiements.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement.</p> : (
              <Liste>
                {f.paiements.map((x) => {
                  const [l, c] = STATUT_PAIEMENT[x.status] ?? [x.status, "bg-stone-100"];
                  return (
                    <div key={x.id} className="flex items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{x.groupe} · tour {x.round} · {x.method}</span>
                      <span className="text-xs text-stone-500">{dateCourte(x.created_at)}</span>
                      <b>{fcfa(x.amount + x.penalty)}</b>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`}>{l}</span>
                    </div>
                  );
                })}
              </Liste>
            )}
          </BlocFiche>
        </>
      )}
    </Volet>
  );
}

function FicheGroupe({ id, fermer, ouvrirUtilisateur, recharger }: { id: string; fermer: () => void; ouvrirUtilisateur: (id: string) => void; recharger: () => void }) {
  const { fondateur, demander } = useContext(AdminCtx);
  const [f, setF] = useState<FicheG | null>(null);
  const [erreur, setErreur] = useState("");
  const [msg, setMsg] = useState("");
  const [statuts, setStatuts] = useState<Record<string, MembreA["statut"]> | null>(null);
  const [filtre, setFiltre] = useState<FiltreStatut>("tous");

  const charger = useCallback(async () => {
    db.rpc("admin_membres", { g: id }).then(({ data, error }) => setStatuts(error ? null : Object.fromEntries(((data as MembreA[]) ?? []).map((m) => [m.membre_id, m.statut]))));
    const { data, error } = await db.rpc("admin_groupe", { g: id });
    if (error) return setErreur(error.message.includes("admin_groupe") ? "Lance d’abord la mise à jour SQL n°14." : error.message);
    setF(data as FicheG);
  }, [id]);
  useEffect(() => { charger(); }, [charger]);

  const action = async (fn: () => Promise<{ error: { message: string } | null }>, ok: string) => {
    setMsg("");
    const { error } = await fn();
    setMsg(error ? "Erreur : " + error.message : ok);
    await charger();
    recharger();
  };

  const g = f?.groupe;
  return (
    <Volet titre={g ? g.name : "Groupe"} sousTitre={g ? `${TYPE[g.type] ?? g.type} · ${fcfa(g.amount)} · ${g.frequency} · tour ${g.current_round}` : undefined} fermer={fermer}>
      {erreur && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
      {!f && !erreur && <p className="text-sm text-stone-500">Chargement…</p>}
      {msg && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800">{msg}</p>}
      {f && !g && <p className="text-sm text-stone-500">Ce groupe n’existe plus.</p>}
      {g && f && (
        <>
          <BlocFiche titre="Informations">
            <div className="space-y-1 text-sm">
              <p>Identifiant : <Identifiant id={g.id} /></p>
              <p>Créé le {dateCourte(g.created_at)} par <b>{g.createur_nom ?? "—"}</b>{g.createur_tel && ` · ${telAffiche(g.createur_tel)}`}</p>
              {g.payment_phone && <p>Numéro qui reçoit l’argent : <b>{telAffiche(g.payment_phone)}</b></p>}
            </div>
          </BlocFiche>

          <BlocFiche titre={`Membres (${f.membres.filter((m) => !m.archive).length})`}>
            {statuts && (
              <div className="mb-2">
                <Puces
                  options={(["tous", "pas_paye", "a_jour", "en_attente", "demande"] as FiltreStatut[]).map((k) => ({
                    id: k,
                    label: k === "tous" ? "Tous" : STATUT_MEMBRE[k][0],
                    n: f.membres.filter((m) => !m.archive && (k === "tous" || statuts[m.id] === k)).length,
                  }))}
                  valeur={filtre}
                  onChange={setFiltre}
                />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
                  <tr><th className="py-2">Nom</th><th>Téléphone</th><th>Situation</th><th>Rôle</th><th></th></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {f.membres.filter((m) => filtre === "tous" || (!m.archive && statuts?.[m.id] === filtre)).map((m) => (
                    <tr key={m.id} className={m.archive ? "opacity-50" : ""}>
                      <td className="py-2">
                        {m.profile_id ? (
                          <button onClick={() => ouvrirUtilisateur(m.profile_id!)} className={`font-semibold underline underline-offset-2 ${m.bloque ? "text-red-600" : "text-emerald-800 decoration-emerald-200"}`}>{m.name}</button>
                        ) : (
                          <span className="font-semibold">{m.name}</span>
                        )}
                        <span className="block text-xs text-stone-500">{!m.profile_id ? "pas encore inscrit" : m.en_attente ? "demande en attente" : m.archive ? "a quitté le groupe" : m.bloque ? "bloqué" : "inscrit"}</span>
                      </td>
                      <td className="whitespace-nowrap">{telAffiche(m.phone)}</td>
                      <td>{statuts?.[m.id] && !m.archive ? <BadgeStatut statut={statuts[m.id]} /> : <span className="text-xs text-stone-400">{m.nb_paiements} paiement(s)</span>}</td>
                      <td>
                        <select
                          value={m.role}
                          disabled={m.archive || !fondateur}
                          title={fondateur ? undefined : "Changement de rôle : envoie un dossier au fondateur"}
                          onChange={(e) => action(async () => await db.rpc("admin_modifier_membre", { membre: m.id, nom: null, telephone: null, nouveau_role: e.target.value }), "Rôle modifié.")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                        >
                          {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="text-right">{m.nb_paiements}</td>
                      <td className="text-right">
                        {!fondateur && !m.archive && (
                          <button onClick={() => demander({ motif: m.en_attente ? "Accepter un membre" : "Retirer un membre", client_profile_id: m.profile_id, client_nom: m.name, client_tel: m.phone, groupe_id: g!.id, groupe_nom: g!.name, donnees: { action: m.en_attente ? "accepter_membre" : "retirer_membre", membre_id: m.id }, resume: `${m.en_attente ? "Accepter" : "Retirer"} ${m.name} · ${g!.name}` })} className="rounded-lg bg-violet-50 px-2 py-1 text-xs font-bold text-violet-700">{m.en_attente ? "Demander l’accord" : "Demander le retrait"}</button>
                        )}
                        {fondateur && m.en_attente && !m.archive && (
                          <button onClick={() => action(async () => await db.rpc("admin_modifier_membre", { membre: m.id, nom: null, telephone: null, nouveau_role: null }), `${m.name} accepté dans le groupe.`)} className="mr-1 rounded-lg bg-sky-600 px-2 py-1 text-xs font-bold text-white">Accepter</button>
                        )}
                        {fondateur && !m.archive && (
                          <button onClick={() => confirm(`Retirer ${m.name} du groupe ?`) && action(async () => await db.rpc("admin_retirer_membre", { membre: m.id }), `${m.name} retiré du groupe.`)} className="rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50">Retirer</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BlocFiche>

          <BlocFiche titre={`Paiements (${f.paiements.length})`}>
            {f.paiements.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement.</p> : (
              <Liste>
                {f.paiements.map((x) => {
                  const [l, c] = STATUT_PAIEMENT[x.status] ?? [x.status, "bg-stone-100"];
                  return (
                    <div key={x.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1 truncate font-semibold">{x.membre ?? "—"} <span className="font-normal text-stone-500">· tour {x.round} · {x.method}{x.transaction_id && !x.transaction_id.startsWith("DECL-") ? ` · réf. ${x.transaction_id}` : ""}</span></span>
                      <span className="text-xs text-stone-500">{dateCourte(x.created_at)}</span>
                      <b>{fcfa(x.amount + x.penalty)}</b>
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${c}`}>{l}</span>
                      {x.status === "en_attente" && !fondateur && (
                        <button onClick={() => demander({ motif: "Confirmer un paiement", client_nom: x.membre, groupe_id: g!.id, groupe_nom: g!.name, montant: x.amount + x.penalty, reference: x.transaction_id && !x.transaction_id.startsWith("DECL-") ? x.transaction_id : null, donnees: { action: "confirmer_paiement", paiement_id: x.id }, resume: `Confirmer le paiement de ${x.membre} (${fcfa(x.amount + x.penalty)}) · ${g!.name}` })} className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2 py-1 text-xs font-bold text-white"><Send size={12} /> Au fondateur</button>
                      )}
                      {x.status === "en_attente" && fondateur && (
                        <span className="flex gap-1">
                          <button onClick={() => action(async () => await db.rpc("admin_paiement_statut", { paiement: x.id, statut: "reussi" }), "Paiement confirmé.")} className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold text-white">Confirmer</button>
                          <button onClick={() => confirm("Refuser ce paiement (argent non reçu) ?") && action(async () => await db.rpc("admin_paiement_statut", { paiement: x.id, statut: "echoue" }), "Paiement refusé.")} className="rounded-lg bg-stone-100 px-2 py-1 text-xs font-bold text-stone-700">Refuser</button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </Liste>
            )}
          </BlocFiche>

          <BlocFiche titre={`Versements (${f.versements.length})`}>
            {f.demandes_versement.filter((d) => d.statut === "en_attente").map((d) => (
              <div key={d.id} className="mb-2 flex flex-wrap items-center gap-2 rounded-xl bg-violet-50 p-2.5 text-sm text-violet-900">
                <span className="min-w-0 flex-1">En attente de validation : <b>{fcfa(d.amount)}</b> pour {d.beneficiary_name} ({d.validations}/{d.requis})</span>
                {!fondateur ? (
                  <button onClick={() => demander({ motif: "Valider un versement", client_nom: d.beneficiary_name, groupe_id: g!.id, groupe_nom: g!.name, montant: d.amount, donnees: { action: "valider_versement", versement_id: d.id }, resume: `Valider le versement de ${fcfa(d.amount)} pour ${d.beneficiary_name} · ${g!.name}` })} className="inline-flex items-center gap-1 rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-bold text-white"><Send size={12} /> Au fondateur</button>
                ) : <>
                <button onClick={() => confirm(`Valider le versement de ${fcfa(d.amount)} pour ${d.beneficiary_name} ?`) && action(async () => await db.rpc("admin_versement_decision", { demande: d.id, accepter: true }), "Versement validé.")} className="rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-bold text-white">Valider</button>
                <button onClick={() => confirm("Refuser ce versement ?") && action(async () => await db.rpc("admin_versement_decision", { demande: d.id, accepter: false }), "Versement refusé.")} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-stone-700">Refuser</button>
                </>}
              </div>
            ))}
            {f.versements.length === 0 ? <p className="text-sm text-stone-500">Aucun versement.</p> : (
              <Liste>
                {f.versements.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{v.beneficiary_name} · tour {v.round} · {v.method}</span>
                    <span className="text-xs text-stone-500">{dateCourte(v.created_at)}</span>
                    <b>{fcfa(v.amount)}</b>
                  </div>
                ))}
              </Liste>
            )}
          </BlocFiche>

          {!fondateur ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button onClick={() => demander({ groupe_id: g.id, groupe_nom: g.name, client_nom: g.createur_nom, client_tel: g.createur_tel })} className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-3 text-sm font-bold text-violet-800"><Send size={15} /> Ouvrir un dossier sur ce groupe</button>
              <button onClick={() => demander({ motif: "Supprimer un groupe", groupe_id: g.id, groupe_nom: g.name, donnees: { action: "supprimer_groupe", groupe_id: g.id }, resume: `Supprimer le groupe « ${g.name} »` })} className="rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600">Demander la suppression</button>
            </div>
          ) : (
          <button
            onClick={async () => {
              if (!confirm(`Supprimer définitivement « ${g.name} » ?`)) return;
              const { error } = await db.rpc("admin_supprimer_groupe", { g: g.id });
              if (error) return setMsg("Erreur : " + error.message);
              recharger();
              fermer();
            }}
            className="w-full rounded-xl border border-red-200 py-3 text-sm font-bold text-red-600 hover:bg-red-50"
          >
            <Trash2 size={15} className="mr-1 inline" /> Supprimer ce groupe
          </button>
          )}
        </>
      )}
    </Volet>
  );
}
