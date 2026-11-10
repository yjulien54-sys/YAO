"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { CLE_SESSION, aEmpreinte, empreinteDisponible, etatCode, oublierSurCeTelephone, verifierEmpreinte, type Etat } from "@/lib/verrou";
import { vibrer } from "@/lib/haptique";
import { ClavierCode } from "./ClavierCode";
import { Check, Fingerprint, Gift, Grid3x3, Repeat, Shuffle, Wallet } from "lucide-react";
import { IconBadge } from "./icons";
import { prenom } from "@/lib/format";


const Drapeau = () => (
  <span className="inline-flex h-3 w-[18px] overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-hidden>
    <span className="flex-1 bg-[#f77f00]" />
    <span className="flex-1 bg-white" />
    <span className="flex-1 bg-[#009e60]" />
  </span>
);

const MEMBRES = [
  ["AK", "bg-orange-100 text-orange-700"],
  ["MT", "bg-emerald-100 text-emerald-700"],
  ["FD", "bg-sky-100 text-sky-700"],
  ["SB", "bg-violet-100 text-violet-700"],
  ["AN", "bg-rose-100 text-rose-700"],
] as const;

const NOTIFS = [
  { icon: Wallet, texte: "Awa a payé 50 000 F", detail: "Confirmé par le trésorier" },
  { icon: Check, texte: "Reçu envoyé à Fatou", detail: "Tontine des commerçantes" },
  { icon: Shuffle, texte: "Tirage au sort effectué", detail: "Tout le groupe voit l’ordre" },
];

/** Compteur animé de 0 à la valeur cible */
function useCompteur(cible: number, duree: number, depart: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now() + depart;
    const pas = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / duree));
      setV(Math.round(cible * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree, depart]);
  return v;
}

type EtatBouton = "repos" | "lecture" | "ok";

/** Bouton rond animé (empreinte ou code) */
function BoutonRond({ etat, onAppui, libelle, aria, icone: Icone, principal }: { etat: EtatBouton; onAppui: () => void; libelle: string; aria: string; icone: typeof Fingerprint; principal?: boolean }) {
  const R = 40, C = 2 * Math.PI * R;
  const appuyer = () => {
    if (etat !== "repos") return;
    vibrer("touche");
    onAppui();
  };

  return (
    <div className="flex w-[110px] flex-col items-center gap-2.5">
      <button type="button" onPointerDown={appuyer} onClick={(e) => e.detail === 0 && appuyer()} aria-label={aria} className="group relative grid h-[92px] w-[92px] place-items-center rounded-full outline-none [touch-action:manipulation]">
        {etat === "repos" && principal && (
          <>
            <span className="onde absolute inset-0 rounded-full ring-2 ring-white/40" />
            <span className="onde absolute inset-0 rounded-full ring-2 ring-white/30" style={{ animationDelay: "1.1s" }} />
          </>
        )}
        <svg viewBox="0 0 92 92" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="46" cy="46" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="3.5" />
          <circle
            cx="46" cy="46" r={R} fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={etat === "repos" ? C : 0}
            style={{ transition: etat === "lecture" ? "stroke-dashoffset 1200ms ease-out" : "stroke-dashoffset 220ms ease-out" }}
          />
        </svg>
        <span className={`relative grid h-[72px] w-[72px] place-items-center rounded-full shadow-xl transition-all duration-300 group-active:scale-90 ${etat === "ok" ? "bg-white text-emerald-700" : "bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm"}`}>
          {etat === "ok" ? <Check size={36} strokeWidth={2.6} className="pop" /> : <Icone size={38} strokeWidth={1.6} className={etat === "lecture" ? "animate-pulse" : ""} />}
        </span>
      </button>
      <p className="glisse-texte text-center text-[0.9rem] font-bold leading-tight tracking-wide">
        {etat === "repos" ? libelle : etat === "lecture" ? "Vérification…" : "Bienvenue !"}
      </p>
    </div>
  );
}

const PAGES_PUBLIQUES = ["/", "/cgu", "/confidentialite", "/mentions-legales", "/telecharger", "/suppression-compte", "/admin"];
const RE_VERROUILLER_MS = 3 * 60_000; // l'application se reverrouille après 3 min en arrière-plan

/** Écran d'accueil sécurisé : code secret à 4 chiffres ou empreinte du téléphone */
export function Bienvenue() {
  const { ready, user, userId, logout } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [notif, setNotif] = useState(-1);
  const [etat, setEtat] = useState<EtatBouton>("repos");
  const [clavier, setClavier] = useState(false);
  const [etatC, setEtatC] = useState<Etat | null>(null);
  const [etatE, setEtatE] = useState<EtatBouton>("repos");
  const [bioDispo, setBioDispo] = useState(false);
  const [activerApres, setActiverApres] = useState(false);
  // Ordinateur : grande fenêtre en deux colonnes, code seulement (pas d'empreinte)
  const [ordi, setOrdi] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const maj = () => setOrdi(mq.matches);
    maj();
    mq.addEventListener("change", maj);
    return () => mq.removeEventListener("change", maj);
  }, []);
  useEffect(() => {
    if (ordi && visible && userId && !etatC) etatCode(userId).then(setEtatC);
  }, [ordi, visible, userId, etatC]);
  useEffect(() => {
    empreinteDisponible().then(setBioDispo);
  }, []);
  const montant = useCompteur(visible ? 400000 : 0, 1600, 1900);
  const nom = user?.name ?? "";
  const actif = ready && !!user && !!userId && !PAGES_PUBLIQUES.includes(path);

  useEffect(() => {
    if (!actif) return;
    try {
      if (sessionStorage.getItem(CLE_SESSION)) return;
    } catch {}
    setSortie(false);
    setEtat("repos");
    setVisible(true);
  }, [actif]);

  // Reverrouillage après un moment en arrière-plan (téléphone posé, autre application…)
  useEffect(() => {
    let cache = 0;
    const vu = () => {
      if (document.hidden) cache = Date.now();
      else if (cache && Date.now() - cache > RE_VERROUILLER_MS && actif) {
        try { sessionStorage.removeItem(CLE_SESSION); } catch {}
        setClavier(false);
        setSortie(false);
        setEtat("repos");
        setEtatE("repos");
        setVisible(true);
      }
    };
    document.addEventListener("visibilitychange", vu);
    return () => document.removeEventListener("visibilitychange", vu);
  }, [actif]);

  // Les notifications arrivent l'une après l'autre, en boucle
  useEffect(() => {
    if (!visible) return;
    const debut = setTimeout(() => setNotif(0), 3600);
    const boucle = setInterval(() => setNotif((n) => (n + 1) % NOTIFS.length), 3200);
    return () => {
      clearTimeout(debut);
      clearInterval(boucle);
    };
  }, [visible]);

  function entrer() {
    try { sessionStorage.setItem(CLE_SESSION, "1"); } catch {}
    setClavier(false);
    setEtat((x) => (etatE === "ok" ? x : "ok"));
    setTimeout(() => setSortie(true), 250);
    setTimeout(() => setVisible(false), 550);
  }

  // Bouton « Code » : ouvre le clavier du code Cotiz (création la première fois)
  async function appuiCode(activer = false) {
    if (!userId) return;
    setEtat("lecture");
    const e = await etatCode(userId);
    setEtatC(e);
    setEtat("repos");
    setActiverApres(activer);
    setClavier(true);
  }

  // Bouton « Empreinte » : le téléphone demande le doigt. Pas encore activée : on passe d'abord par le code
  async function appuiEmpreinte() {
    if (!userId) return;
    if (!aEmpreinte(userId)) return appuiCode(true);
    setEtatE("lecture");
    if (await verifierEmpreinte(userId)) {
      vibrer("ok");
      setEtatE("ok");
      return entrer();
    }
    vibrer("erreur");
    setEtatE("repos");
    appuiCode();
  }

  async function oubli() {
    const uid = userId;
    await logout();
    if (uid) oublierSurCeTelephone(uid);
    try { sessionStorage.removeItem(CLE_SESSION); } catch {}
    setVisible(false);
    router.replace("/");
  }

  if (!actif) return null;
  if (!visible) return null;
  const heure = new Date().getHours();
  const salut = heure >= 18 || heure < 4 ? "Bonsoir" : "Bonjour";
  const n = notif >= 0 ? NOTIFS[notif] : null;

  if (ordi)
    return (
      <div className={`fixed inset-0 z-50 grid place-items-center bg-stone-900/55 p-6 backdrop-blur-sm transition-all duration-300 ${sortie ? "scale-[1.02] opacity-0" : "opacity-100"}`}>
        <div className="grid max-h-[94vh] w-full max-w-[940px] grid-cols-2 overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <section className="degrade-vert relative flex flex-col justify-between overflow-hidden p-10 text-white">
            <div className="motif absolute inset-0 opacity-70" />
            <span className="halo pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="bande-kente kente-defile absolute inset-x-0 top-0" />
            <div className="relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
                <span className="logo-entre relative block h-11 w-11 overflow-hidden rounded-xl shadow-lg shadow-emerald-950/40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/logo.svg" alt="" width={44} height={44} className="h-11 w-11" />
                  <span className="logo-brille pointer-events-none absolute inset-0" />
                </span>
                Cotiz
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20"><Drapeau /> Côte d’Ivoire</span>
            </div>
            <div className="relative my-10">
              <p className="apparait text-base font-semibold text-emerald-50/85" style={{ animationDelay: "300ms" }}>{salut} {prenom(nom)},</p>
              <h1 className="mt-2 text-[2.4rem] font-extrabold leading-[1.1] tracking-tight">
                <span className="mot inline-block" style={{ animationDelay: "450ms" }}>Tes tontines et cotisations,</span>{" "}
                <span className="mot or-brille inline-block" style={{ animationDelay: "700ms" }}>sans palabres.</span>
              </h1>
            </div>
            <p className="apparait relative text-sm text-emerald-50/80" style={{ animationDelay: "900ms" }}>Tout le monde voit qui a payé. Personne ne garde l’argent seul.</p>
          </section>
          <div className="flex items-center overflow-y-auto p-10">
            {userId && etatC ? (
              <ClavierCode uid={userId} defini={etatC.defini} attenteInitiale={etatC.attente} naissanceConnue={etatC.naissance} tel={user?.phone ?? ""} nom={nom} onOk={entrer} onOubli={oubli} integre sansEmpreinte />
            ) : (
              <p className="w-full text-center text-sm text-stone-500">Chargement…</p>
            )}
          </div>
        </div>
      </div>
    );

  return (
    <div className={`fixed inset-0 z-50 mx-auto max-w-md overflow-hidden transition-all duration-300 lg:grid lg:max-w-none lg:place-items-center lg:bg-stone-900/50 lg:backdrop-blur-sm ${sortie ? "scale-[1.04] opacity-0" : "opacity-100"}`}>
      <section className="degrade-vert relative flex h-full flex-col overflow-hidden px-6 pb-8 pt-10 text-white lg:h-[min(820px,92vh)] lg:w-[460px] lg:rounded-[2rem] lg:shadow-2xl">
        <div className="motif absolute inset-0 opacity-70" />
        <span className="halo pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <span className="halo pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/[0.06]" style={{ animationDelay: "-3s" }} />
        <div className="bande-kente kente-defile absolute inset-x-0 top-0" />

        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="logo-entre relative block h-11 w-11 overflow-hidden rounded-xl shadow-lg shadow-emerald-950/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/logo.svg" alt="" width={44} height={44} className="h-11 w-11" />
              <span className="logo-brille pointer-events-none absolute inset-0" />
            </span>
            <span aria-label="Cotiz" className="flex">
              {"Cotiz".split("").map((l, i) => (
                <span key={i} aria-hidden className="lettre inline-block" style={{ animationDelay: `${450 + i * 70}ms` }}>{l}</span>
              ))}
            </span>
          </span>
          <span className="glisse-droite inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20" style={{ animationDelay: "650ms" }}>
            <Drapeau /> Côte d’Ivoire
          </span>
        </div>

        <p className="apparait relative mt-9 text-base font-semibold text-emerald-50/85" style={{ animationDelay: "800ms" }}>
          {salut} {prenom(nom)},
        </p>
        <h1 className="relative mt-1 text-[2rem] font-extrabold leading-[1.15] tracking-tight" aria-label="Tes tontines et cotisations, sans palabres.">
          {["Tes", "tontines", "et", "cotisations,"].map((m, i) => (
            <span key={m} aria-hidden className="mot mr-[0.25em] inline-block" style={{ animationDelay: `${950 + i * 110}ms` }}>{m}</span>
          ))}
          <span aria-hidden className="relative inline-block whitespace-nowrap">
            <span className="mot or-brille mr-[0.25em] inline-block" style={{ animationDelay: "1400ms" }}>sans</span>
            <span className="mot or-brille inline-block" style={{ animationDelay: "1510ms" }}>palabres.</span>
            <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full overflow-visible" aria-hidden>
              <path d="M2 8 C 40 2, 80 2, 110 6 S 170 11, 198 4" fill="none" stroke="#f7c948" strokeWidth="3.5" strokeLinecap="round" className="trait-dore" pathLength={1} />
            </svg>
          </span>
        </h1>

        {/* Carte de démonstration vivante */}
        <div className="relative mx-auto mt-16 w-[90%]">
          {/* Notification qui arrive */}
          <div className="absolute -top-14 left-1/2 z-10 w-[92%] -translate-x-1/2">
            {n && (
              <div key={notif} className="notif-entre flex items-center gap-2.5 rounded-2xl bg-white/95 px-3 py-2 text-stone-900 shadow-xl">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                  <n.icon size={16} strokeWidth={2.2} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[0.8rem] font-bold">{n.texte}</p>
                  <p className="truncate text-[0.7rem] text-stone-500">{n.detail}</p>
                </div>
                <span className="ml-auto text-[0.65rem] text-stone-400">à l’instant</span>
              </div>
            )}
          </div>

          <div className="apparait flotte rounded-3xl bg-white p-4 pt-5 text-stone-900 shadow-2xl shadow-emerald-950/40" style={{ animationDelay: "1500ms" }}>
            <div className="flex items-center gap-3">
              <IconBadge icon={Repeat} ton="orange" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">Tontine des commerçantes</p>
                <p className="inline-flex items-center gap-1 text-xs text-stone-500">Tour 3 sur 10 · <Gift size={12} strokeWidth={1.75} /> Awa reçoit</p>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-xl font-extrabold">{montant.toLocaleString("fr-FR")} F</span>
              <span className="text-xs text-stone-500">sur 500 000 F</span>
            </div>
            <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-orange-500" style={{ width: `${(montant / 500000) * 100}%` }} />
            </div>
            <div className="mt-3 flex items-center">
              <div className="flex -space-x-2">
                {MEMBRES.map(([x, c], i) => (
                  <span key={x} className={`pop grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[0.7rem] font-bold ${c}`} style={{ animationDelay: `${2000 + i * 140}ms` }}>
                    {x}
                  </span>
                ))}
              </div>
              <span className="pop ml-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" style={{ animationDelay: "2800ms" }}>
                <Check size={14} strokeWidth={2.25} /> 8 ont payé
              </span>
            </div>
          </div>
        </div>

        <div className="apparait relative mt-auto space-y-4 pt-8" style={{ animationDelay: "700ms" }}>
          <p className="text-center text-sm text-emerald-50/80">Tout le monde voit qui a payé. Personne ne garde l’argent seul.</p>
          <div className="flex items-start justify-center gap-6">
            {bioDispo && <BoutonRond etat={etatE} onAppui={appuiEmpreinte} libelle="Empreinte" aria="Entrer avec l’empreinte" icone={Fingerprint} principal />}
            <BoutonRond etat={etatE === "ok" ? "repos" : etat} onAppui={() => appuiCode()} libelle="Code secret" aria="Entrer avec le code" icone={Grid3x3} principal={!bioDispo} />
          </div>
        </div>
        {clavier && userId && (
          <ClavierCode uid={userId} defini={!!etatC?.defini} attenteInitiale={etatC?.attente ?? 0} activerApres={activerApres} naissanceConnue={etatC?.naissance} tel={user?.phone ?? ""} nom={nom} onOk={entrer} onFermer={() => setClavier(false)} onOubli={oubli} />
        )}
      </section>
    </div>
  );
}
