"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Clock, Eye, EyeOff, KeyRound, LogOut, Megaphone, Plus, RefreshCw, Search, ShieldAlert, Trash2, Users, UsersRound, Wallet,
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
type Annonce = { id: string; titre: string; texte: string | null; lien: string | null; bouton: string | null; couleur: string; actif: boolean; ordre: number };

const ONGLETS = [
  { id: "apercu", label: "Vue d’ensemble", icon: BarChart3 },
  { id: "inscrits", label: "Inscrits", icon: Users },
  { id: "groupes", label: "Groupes", icon: UsersRound },
  { id: "paiements", label: "Paiements en attente", icon: Clock },
  { id: "codes", label: "Codes oubliés", icon: KeyRound },
  { id: "annonces", label: "Annonces", icon: Megaphone },
] as const;
type Onglet = (typeof ONGLETS)[number]["id"];

const RESULTAT: Record<string, [string, string]> = {
  reussie: ["Réussie", "bg-emerald-50 text-emerald-700"],
  echouee: ["Échouée", "bg-red-50 text-red-700"],
  bloquee: ["Bloquée", "bg-stone-200 text-stone-700"],
  sans_naissance: ["Sans date de naissance", "bg-amber-50 text-amber-800"],
};
const TYPE: Record<string, string> = { tontine: "Tontine", association: "Association", collecte: "Collecte" };
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

  if (!pret) return <Fond><p className="text-center text-sm text-stone-500">Chargement…</p></Fond>;
  if (!email) return <Connexion />;
  if (autorise === null) return <Fond><p className="text-center text-sm text-stone-500">Vérification de l’accès…</p></Fond>;
  if (!autorise)
    return (
      <Fond>
        <div className="carte mx-auto max-w-md p-6 text-center">
          <ShieldAlert className="mx-auto text-red-600" size={36} />
          <p className="mt-3 text-lg font-bold">Accès refusé</p>
          <p className="mt-1 text-sm text-stone-600">Le compte <b>{email}</b> n’est pas administrateur. Ajoute cet e-mail dans la table <code>admins</code> de Supabase (mise à jour SQL n°10).</p>
          <button onClick={() => db.auth.signOut()} className="mt-4 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-bold text-white">Se déconnecter</button>
        </div>
      </Fond>
    );
  return <TableauDeBord email={email} />;
}

function Fond({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f7f5f0] px-4 py-16">{children}</div>;
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
    <Fond>
      <form onSubmit={connecter} className="carte mx-auto max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <div>
            <p className="text-lg font-extrabold leading-tight">Administration</p>
            <p className="text-xs text-stone-500">Réservé à l’équipe Cotiz</p>
          </div>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">E-mail</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className={champ} required />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Mot de passe</span>
          <div className="relative">
            <input type={voir ? "text" : "password"} value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="current-password" className={`${champ} pr-10`} required />
            <button type="button" onClick={() => setVoir(!voir)} className="absolute inset-y-0 right-2 grid place-items-center text-stone-400" aria-label="Afficher le mot de passe">
              {voir ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
        <button disabled={occupe} className="w-full rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-60">{occupe ? "Connexion…" : "Se connecter"}</button>
      </form>
    </Fond>
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
  const [charge, setCharge] = useState(false);
  const [msg, setMsg] = useState("");

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
    const err = [s, i, g, a, d, an].find((r) => r.error)?.error;
    setMsg(err ? "Erreur : " + err.message : "");
    setCharge(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const compteurs: Partial<Record<Onglet, number>> = { inscrits: inscrits.length, groupes: groupes.length, paiements: attente.length, codes: demandes.length, annonces: annonces.length };

  return (
    <div className="min-h-dvh bg-[#f7f5f0] text-stone-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="" width={34} height={34} className="h-[34px] w-[34px] rounded-[10px]" />
          <div className="min-w-0 flex-1">
            <p className="font-extrabold leading-tight">Cotiz · Administration</p>
            <p className="truncate text-xs text-stone-500">{email}</p>
          </div>
          <button onClick={charger} className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-600" aria-label="Actualiser">
            <RefreshCw size={17} className={charge ? "animate-spin" : ""} />
          </button>
          <button onClick={() => db.auth.signOut()} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-2 text-xs font-bold text-stone-700">
            <LogOut size={15} /> Quitter
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {ONGLETS.map(({ id, label, icon: I }) => (
            <button
              key={id}
              onClick={() => setOnglet(id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition ${onglet === id ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              <I size={16} /> {label}
              {compteurs[id] !== undefined && <span className={`rounded-full px-1.5 text-xs ${onglet === id ? "bg-white/20" : "bg-stone-200"}`}>{compteurs[id]}</span>}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-5">
        {msg && <p className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{msg}</p>}
        {onglet === "apercu" && <Apercu stats={stats} attente={attente} demandes={demandes} aller={setOnglet} />}
        {onglet === "inscrits" && <Inscrits liste={inscrits} />}
        {onglet === "groupes" && <Groupes liste={groupes} recharger={charger} />}
        {onglet === "paiements" && <Paiements liste={attente} />}
        {onglet === "codes" && <Codes liste={demandes} recharger={charger} />}
        {onglet === "annonces" && <Annonces liste={annonces} recharger={charger} />}
      </main>
    </div>
  );
}

function Chiffre({ label, valeur, detail, icone: I, ton = "vert", onClick }: { label: string; valeur: string; detail?: string; icone: typeof Users; ton?: "vert" | "orange" | "gris"; onClick?: () => void }) {
  const tons = { vert: "bg-emerald-50 text-emerald-700", orange: "bg-amber-50 text-amber-700", gris: "bg-stone-100 text-stone-600" };
  return (
    <button onClick={onClick} disabled={!onClick} className="carte flex items-start gap-3 p-4 text-left transition enabled:hover:border-emerald-300">
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tons[ton]}`}><I size={20} /></span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-stone-500">{label}</span>
        <span className="block text-xl font-extrabold leading-tight">{valeur}</span>
        {detail && <span className="block text-xs text-stone-500">{detail}</span>}
      </span>
    </button>
  );
}

function Apercu({ stats, attente, demandes, aller }: { stats: Stats | null; attente: Attente[]; demandes: Demande[]; aller: (o: Onglet) => void }) {
  if (!stats) return <p className="text-sm text-stone-500">Chargement des chiffres…</p>;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Inscrits" valeur={String(stats.inscrits)} detail={`+${stats.inscrits_7j} cette semaine`} icone={Users} onClick={() => aller("inscrits")} />
        <Chiffre label="Groupes" valeur={String(stats.groupes)} detail={`${stats.membres} membres au total`} icone={UsersRound} onClick={() => aller("groupes")} />
        <Chiffre label="Argent confirmé" valeur={fcfa(stats.montant_confirme)} detail={`${stats.paiements_confirmes} paiements`} icone={Wallet} />
        <Chiffre label="En attente de confirmation" valeur={fcfa(stats.montant_attente)} detail={`${stats.paiements_attente} paiements`} icone={Clock} ton="orange" onClick={() => aller("paiements")} />
        <Chiffre label="Codes secrets créés" valeur={String(stats.codes_definis)} detail={`sur ${stats.inscrits} inscrits`} icone={KeyRound} ton="gris" />
        <Chiffre label="Codes oubliés (7 jours)" valeur={String(stats.demandes_code_7j)} icone={ShieldAlert} ton="gris" onClick={() => aller("codes")} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="carte p-4">
          <p className="mb-2 font-bold">Derniers paiements en attente</p>
          {attente.length === 0 ? <p className="text-sm text-stone-500">Aucun paiement en attente.</p> : <Liste>{attente.slice(0, 5).map((a) => <LigneAttente key={a.id} a={a} />)}</Liste>}
        </section>
        <section className="carte p-4">
          <p className="mb-2 font-bold">Dernières demandes « code oublié »</p>
          {demandes.length === 0 ? <p className="text-sm text-stone-500">Aucune demande.</p> : <Liste>{demandes.slice(0, 5).map((d, i) => <LigneDemande key={i} d={d} />)}</Liste>}
        </section>
      </div>
    </>
  );
}

const Liste = ({ children }: { children: React.ReactNode }) => <div className="divide-y divide-stone-100">{children}</div>;

function Recherche({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${champ} pl-9`} />
    </div>
  );
}

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");

function Inscrits({ liste }: { liste: Inscrit[] }) {
  const [q, setQ] = useState("");
  const vus = useMemo(() => liste.filter((i) => !q || norm(i.nom).includes(norm(q)) || i.telephone.replace(/\D/g, "").includes(q.replace(/\D/g, "") || "§")), [liste, q]);
  return (
    <section className="carte space-y-3 p-4">
      <Recherche valeur={q} onChange={setQ} placeholder="Chercher un nom ou un numéro…" />
      <p className="text-xs text-stone-500">{vus.length} inscrit{vus.length > 1 ? "s" : ""}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-stone-500">
            <tr><th className="py-2">Nom</th><th>Téléphone</th><th>Naissance</th><th>Inscrit le</th><th className="text-right">Groupes</th><th className="text-right">Code</th></tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {vus.map((i) => (
              <tr key={i.id}>
                <td className="py-2.5 font-semibold">{i.nom}</td>
                <td className="whitespace-nowrap">{telAffiche(i.telephone)}</td>
                <td>{i.naissance ? dateCourte(i.naissance) : <span className="text-stone-400">—</span>}</td>
                <td className="whitespace-nowrap">{dateCourte(i.inscrit_le)}</td>
                <td className="text-right">{i.nb_groupes}</td>
                <td className="text-right">{i.code_defini ? <span className="text-emerald-700">✓</span> : <span className="text-stone-400">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Groupes({ liste, recharger }: { liste: Groupe[]; recharger: () => void }) {
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const vus = liste.filter((g) => !q || norm(g.nom).includes(norm(q)) || norm(g.tresorier).includes(norm(q)));
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
    <section className="carte space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1"><Recherche valeur={q} onChange={setQ} placeholder="Chercher un groupe ou un trésorier…" /></div>
        {liste.length > 0 && (
          <button onClick={toutSupprimer} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50">
            <Trash2 size={16} /> Supprimer tous les groupes
          </button>
        )}
      </div>
      {msg && <p className="text-sm font-medium text-emerald-800">{msg}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {vus.map((g) => (
          <div key={g.id} className="rounded-2xl border border-stone-200 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-bold">{g.nom}</p>
                <p className="text-xs text-stone-500">{TYPE[g.type] ?? g.type} · {fcfa(g.montant)} · {g.frequence} · tour {g.tour}</p>
              </div>
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

function Paiements({ liste }: { liste: Attente[] }) {
  return (
    <section className="carte p-4">
      <p className="mb-1 text-sm text-stone-600">Paiements déclarés par les membres, que le trésorier n’a pas encore confirmés. Seul le trésorier du groupe peut confirmer.</p>
      {liste.length === 0 ? <p className="py-3 text-sm text-stone-500">Aucun paiement en attente.</p> : <Liste>{liste.map((a) => <LigneAttente key={a.id} a={a} />)}</Liste>}
    </section>
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
      <form onSubmit={reinitialiser} className="carte space-y-3 p-4">
        <p className="font-bold">Réinitialiser un code secret</p>
        <p className="text-sm text-stone-600">Pour une personne qui a oublié son code et n’a pas pu le récupérer seule. <b>Vérifie d’abord son identité</b> (appelle-la sur son numéro).</p>
        <div className="flex gap-2">
          <input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="07 07 12 34 56" className={champ} />
          <button className="shrink-0 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">Réinitialiser</button>
        </div>
        {msg && <p className="text-sm font-medium text-emerald-800">{msg}</p>}
      </form>
      <section className="carte p-4">
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
      <section className="carte p-4">
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
