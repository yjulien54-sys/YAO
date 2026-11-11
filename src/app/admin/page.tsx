"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateNaissance } from "@/components/DateNaissance";
import {
  Ban, BarChart3, CheckCircle2, Contact, ExternalLink, ScrollText, ChevronRight, Clock, Copy, Eye, EyeOff, KeyRound, LayoutDashboard, Lock, LogOut, Mail, Megaphone, Plus, RefreshCw, Search, ShieldAlert, ShieldCheck, Trash2, Users, UsersRound, Wallet, X,
} from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";
import { dateCourte, fcfa, telAffiche } from "@/lib/format";

type Stats = {
  inscrits: number; inscrits_7j: number; groupes: number; membres: number;
  paiements_confirmes: number; paiements_attente: number; montant_confirme: number; montant_attente: number;
  codes_definis: number; demandes_code_7j: number;
};
type Inscrit = { id: string; nom: string; telephone: string; naissance: string | null; inscrit_le: string; nb_groupes: number; code_defini: boolean };
type Groupe = { id: string; nom: string; type: string; montant: number; frequence: string; tour: number; cree_le: string; nb_membres: number; tresorier: string | null; tresorier_tel: string | null; collecte: number; en_attente: number };
type Attente = { id: string; le: string; groupe: string; membre: string; montant: number; moyen: string; tresorier_tel: string | null };
type Demande = { le: string; nom: string | null; telephone: string | null; nom_saisi: string | null; naissance_saisie: string | null; resultat: string };
type MembreA = { membre_id: string; profile_id: string | null; nom: string; telephone: string; role: string; bloque: boolean; groupe_id: string; groupe: string; type: string; montant: number; tour: number; statut: "a_jour" | "pas_paye" | "en_attente" | "demande"; paye_tour: number; total_paye: number; nb_attente: number };
type VersementA = { id: string; le: string; groupe_id: string; groupe: string; beneficiaire: string; montant: number; moyen: string; tour: number; requis: number; validations: number; demande_par: string | null };
type LigneJournal = { id: number; le: string; admin_email: string | null; action: string; cible: string | null; detail: string | null };
type Annonce = { id: string; titre: string; texte: string | null; lien: string | null; bouton: string | null; couleur: string; actif: boolean; ordre: number };

const ONGLETS = [
  { id: "apercu", label: "Vue d’ensemble", icon: LayoutDashboard, ton: "emerald" },
  { id: "stats", label: "Statistiques", icon: BarChart3, ton: "teal" },
  { id: "inscrits", label: "Inscrits", icon: Users, ton: "sky" },
  { id: "groupes", label: "Groupes", icon: UsersRound, ton: "violet" },
  { id: "membres", label: "Membres par groupe", icon: Contact, ton: "teal" },
  { id: "paiements", label: "À valider", icon: Clock, ton: "amber" },
  { id: "codes", label: "Codes oubliés", icon: KeyRound, ton: "rose" },
  { id: "annonces", label: "Annonces", icon: Megaphone, ton: "orange" },
  { id: "journal", label: "Journal admin", icon: ScrollText, ton: "emerald" },
] as const;
type Onglet = (typeof ONGLETS)[number]["id"];
type Ton = (typeof ONGLETS)[number]["ton"] | "red";

/** Couleurs par rubrique (pastille d'icône, carte chiffrée) */
const TON: Record<Ton, { pastille: string; carte: string; texte: string; barre: string }> = {
  emerald: { pastille: "bg-emerald-100 text-emerald-700", carte: "from-emerald-50 to-white border-emerald-100", texte: "text-emerald-700", barre: "bg-emerald-500" },
  teal: { pastille: "bg-teal-100 text-teal-700", carte: "from-teal-50 to-white border-teal-100", texte: "text-teal-700", barre: "bg-teal-500" },
  sky: { pastille: "bg-sky-100 text-sky-700", carte: "from-sky-50 to-white border-sky-100", texte: "text-sky-700", barre: "bg-sky-500" },
  violet: { pastille: "bg-violet-100 text-violet-700", carte: "from-violet-50 to-white border-violet-100", texte: "text-violet-700", barre: "bg-violet-500" },
  amber: { pastille: "bg-amber-100 text-amber-700", carte: "from-amber-50 to-white border-amber-100", texte: "text-amber-700", barre: "bg-amber-500" },
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
const TYPE_COULEUR: Record<string, string> = { tontine: "#059669", association: "#ea580c", collecte: "#7c3aed" };
const champ = "w-full rounded-xl border border-stone-300/80 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

export default function Admin() {
  const [pret, setPret] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [autorise, setAutorise] = useState<boolean | null>(null);

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
    db.rpc("is_admin").then(({ data, error }) => setAutorise(!error && data === true));
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
  return <TableauDeBord email={email} />;
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
    <div className="degrade-vert relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
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
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: mdp });
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
            <p className="mt-1 text-sm text-stone-500">Connecte-toi avec ton e-mail et ton mot de passe</p>
          </div>
          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-stone-700">E-mail</span>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="ton@email.com" className={`${champ} !py-3 pl-11`} required />
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

function TableauDeBord({ email }: { email: string }) {
  const [onglet, setOnglet] = useState<Onglet>("apercu");
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
      db.from("annonces").select("id, titre, texte, lien, bouton, couleur, actif, ordre").order("ordre"),
    ]);
    setStats((s.data as Stats) ?? null);
    setInscrits((i.data as Inscrit[]) ?? []);
    setGroupes((g.data as Groupe[]) ?? []);
    setAttente((a.data as Attente[]) ?? []);
    setDemandes((d.data as Demande[]) ?? []);
    setAnnonces((an.data as Annonce[]) ?? []);
    // Mise à jour SQL n°16 (facultative tant qu'elle n'est pas faite)
    const [mb, vs, jn] = await Promise.all([db.rpc("admin_membres"), db.rpc("admin_versements_attente"), db.rpc("admin_journal")]);
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
  const compteurs: Partial<Record<Onglet, number>> = { inscrits: inscrits.length, groupes: groupes.length, membres: membres?.length, paiements: aValider, codes: demandes.length, annonces: annonces.length };
  const alerte: Partial<Record<Onglet, boolean>> = { paiements: aValider > 0 };
  const voirMembres = (t: string) => { setTypeMembres(t); setOnglet("membres"); };
  const courant = ONGLETS.find((o) => o.id === onglet)!;
  const heure = new Date().getHours();
  const salut = heure < 12 ? "Bonjour" : heure < 18 ? "Bon après-midi" : "Bonsoir";

  return (
    <div className="min-h-dvh bg-[#f4f2ec] text-stone-900 lg:flex">
      {/* Barre latérale (ordinateur) */}
      <aside className="degrade-vert relative hidden w-[260px] shrink-0 overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <div className="motif pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative flex items-center gap-3 px-5 pb-6 pt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl shadow-md" />
          <div>
            <p className="text-lg font-extrabold leading-tight">Cotiz</p>
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-emerald-100/80">Administration</p>
          </div>
        </div>
        <nav className="relative flex-1 space-y-1 px-3">
          {ONGLETS.map(({ id, label, icon: I }) => {
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
          <p className="truncate text-xs text-emerald-50/80">Connecté : <b className="text-white">{email}</b></p>
          <button onClick={() => db.auth.signOut()} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/15 py-2 text-xs font-bold hover:bg-white/25">
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
              <p className="font-extrabold leading-tight">Cotiz · Admin</p>
              <p className="truncate text-xs text-emerald-50/80">{email}</p>
            </div>
            <button onClick={charger} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Actualiser"><RefreshCw size={17} className={charge ? "animate-spin" : ""} /></button>
            <button onClick={() => db.auth.signOut()} className="grid h-9 w-9 place-items-center rounded-full bg-white/15" aria-label="Se déconnecter"><LogOut size={16} /></button>
          </div>
          <nav className="relative flex gap-1.5 overflow-x-auto px-3 pb-3" data-pas-glisser>
            {ONGLETS.map(({ id, label, icon: I }) => (
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
          {onglet === "apercu" && <Apercu stats={stats} inscrits={inscrits} groupes={groupes} attente={attente} demandes={demandes} aller={setOnglet} ouvrir={(type, id) => setFiche({ type, id })} />}
          {onglet === "stats" && <Statistiques stats={stats} inscrits={inscrits} groupes={groupes} ouvrir={(id) => setFiche({ type: "groupe", id })} />}
          {onglet === "inscrits" && <Inscrits liste={inscrits} ouvrir={(id) => setFiche({ type: "utilisateur", id })} />}
          {onglet === "groupes" && <Groupes liste={groupes} recharger={charger} ouvrir={(id) => setFiche({ type: "groupe", id })} voirMembres={voirMembres} />}
          {onglet === "membres" && <Membres liste={membres} typeInitial={typeMembres} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} />}
          {onglet === "paiements" && <Paiements liste={attente} versements={versements} recharger={charger} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} />}
          {onglet === "journal" && <Journal liste={journal} />}
          {onglet === "codes" && <Codes liste={demandes} recharger={charger} />}
          {onglet === "annonces" && <Annonces liste={annonces} recharger={charger} />}
        </main>
      </div>
      {fiche?.type === "utilisateur" && <FicheUtilisateur id={fiche.id} fermer={() => setFiche(null)} ouvrirGroupe={(id) => setFiche({ type: "groupe", id })} recharger={charger} />}
      {fiche?.type === "groupe" && <FicheGroupe id={fiche.id} fermer={() => setFiche(null)} ouvrirUtilisateur={(id) => setFiche({ type: "utilisateur", id })} recharger={charger} />}
    </div>
  );
}

/** Carte chiffrée colorée */
function Chiffre({ label, valeur, detail, icone: I, ton = "emerald", onClick }: { label: string; valeur: string; detail?: string; icone: typeof Users; ton?: Ton; onClick?: () => void }) {
  const t = TON[ton];
  return (
    <button onClick={onClick} disabled={!onClick} className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-4 text-left shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md ${t.carte}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.pastille}`}><I size={20} /></span>
        {onClick && <ChevronRight size={16} className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />}
      </div>
      <p className="mt-3 text-xs font-semibold text-stone-500">{label}</p>
      <p className="mt-0.5 truncate text-[1.45rem] font-extrabold leading-tight tracking-tight">{valeur}</p>
      {detail && <p className={`mt-0.5 text-xs font-medium ${t.texte}`}>{detail}</p>}
    </button>
  );
}

function Bloc({ titre, sous, action, children, className = "" }: { titre: string; sous?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5 ${className}`}>
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
  const max = Math.max(1, ...jours.map((j) => j.n));
  const total = jours.reduce((s, j) => s + j.n, 0);
  const [survol, setSurvol] = useState<number | null>(null);
  const sel = survol !== null ? jours[survol] : null;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-xs text-stone-500">
        <span><b className="text-lg font-extrabold text-stone-900">{total}</b> inscriptions en 30 jours</span>
        <span className="font-medium text-stone-700">{sel ? `${sel.d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} : ${sel.n} inscrit${sel.n > 1 ? "s" : ""}` : "Touche une barre pour le détail"}</span>
      </div>
      <div className="relative h-36">
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-stone-200" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-stone-200" />
        <span className="absolute -top-2 right-0 bg-white pl-1 text-[0.65rem] text-stone-400">{max}</span>
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-stone-300" onMouseLeave={() => setSurvol(null)}>
          {jours.map((j, k) => (
            <button key={k} type="button" aria-label={`${j.d.toLocaleDateString("fr-FR")} : ${j.n}`}
              onMouseEnter={() => setSurvol(k)} onFocus={() => setSurvol(k)} onClick={() => setSurvol(k)}
              className="flex h-full flex-1 items-end">
              <span className={`block w-full rounded-t-[4px] transition-colors ${survol === k ? "bg-emerald-800" : "bg-emerald-500"}`} style={{ height: j.n ? `${Math.max(4, (j.n / max) * 100)}%` : "2px", opacity: j.n ? 1 : 0.25 }} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem] text-stone-400">
        <span>{jours[0].d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
        <span>Aujourd’hui</span>
      </div>
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
            <span className="shrink-0 font-bold text-stone-900">{format(l.n)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-100">
            <div className="h-full rounded-full" style={{ width: `${Math.max(2, (l.n / max) * 100)}%`, background: l.couleur }} />
          </div>
        </button>
      ))}
    </div>
  );
}

function Apercu({ stats, inscrits, groupes, attente, demandes, aller, ouvrir }: { stats: Stats | null; inscrits: Inscrit[]; groupes: Groupe[]; attente: Attente[]; demandes: Demande[]; aller: (o: Onglet) => void; ouvrir: (type: "utilisateur" | "groupe", id: string) => void }) {
  if (!stats) return <p className="text-sm text-stone-500">Chargement des chiffres…</p>;
  const bloques = inscrits.filter((i) => i.nom.endsWith("(bloqué)")).length;
  const echecs = demandes.filter((d) => d.resultat === "echouee" || d.resultat === "bloquee").length;
  const derniers = [...inscrits].sort((a, b) => b.inscrit_le.localeCompare(a.inscrit_le)).slice(0, 6);
  const aSurveiller = [
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Inscrits dans un groupe" valeur={`${pct(avecGroupe, inscrits.length)} %`} detail={`${avecGroupe} sur ${inscrits.length}`} icone={Users} ton="sky" />
        <Chiffre label="Code secret créé" valeur={`${pct(stats.codes_definis, stats.inscrits)} %`} detail={`${stats.codes_definis} sur ${stats.inscrits}`} icone={KeyRound} ton="rose" />
        <Chiffre label="Membres par groupe" valeur={String(moyenne)} detail="en moyenne" icone={UsersRound} ton="violet" />
        <Chiffre label="Paiement moyen" valeur={fcfa(stats.paiements_confirmes ? Math.round(stats.montant_confirme / stats.paiements_confirmes) : 0)} detail={`${stats.paiements_confirmes} paiements confirmés`} icone={Wallet} ton="emerald" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Groupes par type" sous="Nombre de groupes">
          <Barres lignes={parType.map((p) => ({ label: TYPE[p.t], n: p.n, couleur: TYPE_COULEUR[p.t] }))} />
        </Bloc>
        <Bloc titre="Argent confirmé par type" sous="Total des cotisations confirmées">
          <Barres lignes={parType.map((p) => ({ label: TYPE[p.t], n: p.argent, couleur: TYPE_COULEUR[p.t] }))} format={fcfa} />
        </Bloc>
        <Bloc titre="Groupes qui cotisent le plus" sous="Touche un groupe pour ouvrir sa fiche">
          {top.length === 0 ? <p className="text-sm text-stone-500">Aucun groupe.</p> : <Barres lignes={top.map((g) => ({ label: g.nom, n: g.collecte, couleur: TYPE_COULEUR[g.type] ?? "#059669", onClick: () => ouvrir(g.id) }))} format={fcfa} />}
        </Bloc>
        <Bloc titre="Taille des groupes" sous="Nombre de groupes par nombre de membres">
          <Barres lignes={tailles.map((t) => ({ ...t, couleur: "#0d9488" }))} />
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
        {liste.length > 0 && (
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
              <button onClick={() => supprimer(g)} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50" aria-label={`Supprimer ${g.nom}`}>
                <Trash2 size={14} /> Supprimer
              </button>
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
        <b>Tu as la main.</b> Si le trésorier ne répond pas, tu peux confirmer un paiement ou valider un versement à sa place. Vérifie d’abord avec lui ou avec le membre (appel, capture Wave…). Chaque action est notée dans le <b>Journal admin</b>.
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}
      <Bloc titre={`Paiements à confirmer (${liste.length})`} sous="Déclarés par les membres, pas encore confirmés par le trésorier">
        {liste.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement en attente.</p> : (
          <Liste>
            {liste.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.membre} · <span className="text-stone-600">{a.groupe}</span></p>
                  <p className="text-xs text-stone-500">{dateCourte(a.le)} · {a.moyen}{a.tresorier_tel && <> · trésorier <a href={`tel:${a.tresorier_tel}`} className="font-semibold text-emerald-700 underline">{telAffiche(a.tresorier_tel)}</a></>}</p>
                </div>
                <b className="shrink-0">{fcfa(a.montant)}</b>
                <span className="flex shrink-0 gap-1.5">
                  <button disabled={!!occupe} onClick={() => confirm(`Confirmer le paiement de ${a.membre} (${fcfa(a.montant)}) à la place du trésorier ?`) && agir(a.id, () => db.rpc("admin_paiement_statut", { paiement: a.id, statut: "reussi" }), `Paiement de ${a.membre} confirmé.`)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{occupe === a.id ? "…" : "Confirmer"}</button>
                  <button disabled={!!occupe} onClick={() => confirm(`Refuser le paiement de ${a.membre} (argent non reçu) ?`) && agir(a.id, () => db.rpc("admin_paiement_statut", { paiement: a.id, statut: "echoue" }), `Paiement de ${a.membre} refusé.`)} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50">Refuser</button>
                </span>
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
                <span className="flex shrink-0 gap-1.5">
                  <button disabled={!!occupe} onClick={() => confirm(`Valider le versement de ${fcfa(v.montant)} pour ${v.beneficiaire} ?`) && agir(v.id, () => db.rpc("admin_versement_decision", { demande: v.id, accepter: true }), "Versement validé.")} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{occupe === v.id ? "…" : "Valider"}</button>
                  <button disabled={!!occupe} onClick={() => confirm("Refuser ce versement ?") && agir(v.id, () => db.rpc("admin_versement_decision", { demande: v.id, accepter: false }), "Versement refusé.")} className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700 disabled:opacity-50">Refuser</button>
                </span>
              </div>
            ))}
          </Liste>
        )}
      </Bloc>
    </>
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
  const vide = { titre: "", texte: "", lien: "", bouton: "", couleur: "vert", ordre: liste.length + 1 };
  const [f, setF] = useState(vide);
  const [msg, setMsg] = useState("");
  const maj = async (id: string, v: Partial<Annonce>) => {
    const { error } = await db.from("annonces").update(v).eq("id", id);
    setMsg(error ? "Erreur : " + error.message : "Annonce mise à jour.");
    recharger();
  };
  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!f.titre.trim()) return setMsg("Le titre est obligatoire.");
    const { error } = await db.from("annonces").insert({ titre: f.titre.trim(), texte: f.texte || null, lien: f.lien || null, bouton: f.bouton || null, couleur: f.couleur, ordre: Number(f.ordre) || 0 });
    setMsg(error ? "Erreur : " + error.message : "Annonce publiée.");
    if (!error) setF({ ...vide, ordre: liste.length + 2 });
    recharger();
  }
  return (
    <>
      <section className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm lg:p-5">
        <p className="mb-2 font-bold">Annonces affichées sur l’accueil</p>
        <Liste>
          {liste.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className={`h-8 w-8 shrink-0 rounded-lg ${a.couleur === "orange" ? "degrade-or" : a.couleur === "sombre" ? "bg-stone-800" : a.couleur === "bleu" ? "bg-sky-600" : "degrade-vert"}`} />
              <div className="min-w-0 flex-1">
                <p className={`truncate font-semibold ${a.actif ? "" : "text-stone-400 line-through"}`}>{a.titre}</p>
                <p className="truncate text-xs text-stone-500">{a.texte ?? ""}{a.lien ? ` · ${a.lien}` : ""}</p>
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
                action(async () => await db.rpc("admin_modifier_profil", { p: id, nom: form.nom, telephone: form.tel, naissance: form.naissance || null }), "Informations modifiées.");
              }}
            >
              <label className="text-xs font-semibold text-stone-500">Nom<input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} className={champ} /></label>
              <label className="text-xs font-semibold text-stone-500">Téléphone<input value={form.tel} onChange={(e) => setForm({ ...form, tel: e.target.value })} inputMode="tel" className={champ} /></label>
              <label className="text-xs font-semibold text-stone-500">Naissance<DateNaissance value={form.naissance} onChange={(v) => setForm((x) => ({ ...x, naissance: v }))} /></label>
              <button className="rounded-xl bg-emerald-700 py-2.5 text-sm font-bold text-white sm:col-span-3">Enregistrer les modifications</button>
            </form>
          </BlocFiche>

          <BlocFiche titre="Sécurité">
            <p className="text-sm">Code secret : {f.code?.defini ? <b className="text-emerald-700">créé</b> : <b className="text-stone-500">pas encore créé</b>}{f.code?.modifie_le && ` · modifié le ${dateCourte(f.code.modifie_le)}`}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => confirm("Réinitialiser son code secret ? La personne en créera un nouveau à sa prochaine ouverture.") && action(async () => await db.rpc("admin_reinitialiser_code_profil", { p: id }), "Code réinitialisé.")} className="rounded-xl border border-stone-200 px-3 py-2 text-sm font-bold">
                <KeyRound size={15} className="mr-1 inline" /> Réinitialiser le code
              </button>
              {p.bloque ? (
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
                          disabled={m.archive}
                          onChange={(e) => action(async () => await db.rpc("admin_modifier_membre", { membre: m.id, nom: null, telephone: null, nouveau_role: e.target.value }), "Rôle modifié.")}
                          className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs"
                        >
                          {Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td className="text-right">{m.nb_paiements}</td>
                      <td className="text-right">
                        {m.en_attente && !m.archive && (
                          <button onClick={() => action(async () => await db.rpc("admin_modifier_membre", { membre: m.id, nom: null, telephone: null, nouveau_role: null }), `${m.name} accepté dans le groupe.`)} className="mr-1 rounded-lg bg-sky-600 px-2 py-1 text-xs font-bold text-white">Accepter</button>
                        )}
                        {!m.archive && (
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
                      {x.status === "en_attente" && (
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
                <button onClick={() => confirm(`Valider le versement de ${fcfa(d.amount)} pour ${d.beneficiary_name} ?`) && action(async () => await db.rpc("admin_versement_decision", { demande: d.id, accepter: true }), "Versement validé.")} className="rounded-lg bg-violet-700 px-2.5 py-1 text-xs font-bold text-white">Valider</button>
                <button onClick={() => confirm("Refuser ce versement ?") && action(async () => await db.rpc("admin_versement_decision", { demande: d.id, accepter: false }), "Versement refusé.")} className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-stone-700">Refuser</button>
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
        </>
      )}
    </Volet>
  );
}
