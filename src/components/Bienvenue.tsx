"use client";

import { useEffect, useState } from "react";
import { Check, Fingerprint, Gift, Repeat, Shuffle, Wallet } from "lucide-react";
import { IconBadge } from "./icons";
import { prenom } from "@/lib/format";

const CLE = "cotiz:bienvenue-vue";

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

/** Bouton empreinte : un appui remplit le cercle, affiche une coche, puis on entre */
function BoutonEmpreinte({ onEntrer }: { onEntrer: () => void }) {
  const [etat, setEtat] = useState<"repos" | "lecture" | "ok">("repos");
  const R = 46, C = 2 * Math.PI * R;

  function appuyer() {
    if (etat !== "repos") return;
    setEtat("lecture");
    setTimeout(() => setEtat("ok"), 750);
    setTimeout(onEntrer, 1150);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button type="button" onClick={appuyer} aria-label="Entrer dans Cotiz" className="group relative grid h-[104px] w-[104px] place-items-center rounded-full outline-none">
        {/* Ondes qui pulsent autour */}
        {etat === "repos" && (
          <>
            <span className="onde absolute inset-0 rounded-full ring-2 ring-white/40" />
            <span className="onde absolute inset-0 rounded-full ring-2 ring-white/30" style={{ animationDelay: "1.1s" }} />
          </>
        )}
        {/* Cercle de lecture */}
        <svg viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="52" cy="52" r={R} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="4" />
          <circle
            cx="52" cy="52" r={R} fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={etat === "repos" ? C : 0}
            style={{ transition: "stroke-dashoffset 750ms cubic-bezier(0.65, 0, 0.35, 1)" }}
          />
        </svg>
        <span className={`relative grid h-[80px] w-[80px] place-items-center rounded-full shadow-xl transition-all duration-300 group-active:scale-95 ${etat === "ok" ? "bg-white text-emerald-700" : "bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-sm"}`}>
          {etat === "ok" ? <Check size={40} strokeWidth={2.6} className="pop" /> : <Fingerprint size={44} strokeWidth={1.6} className={etat === "lecture" ? "animate-pulse" : ""} />}
        </span>
      </button>
      <p className="glisse-texte text-[0.95rem] font-bold tracking-wide">
        {etat === "repos" ? "Appuie pour entrer" : etat === "lecture" ? "Vérification…" : "Bienvenue !"}
      </p>
    </div>
  );
}

/** Écran d'accueil affiché à l'ouverture de l'application (une fois par session) */
export function Bienvenue({ nom }: { nom: string }) {
  const [visible, setVisible] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [notif, setNotif] = useState(-1);
  const montant = useCompteur(400000, 1600, 700);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLE)) return;
      sessionStorage.setItem(CLE, "1");
    } catch {}
    setVisible(true);
  }, []);

  // Les notifications arrivent l'une après l'autre, en boucle
  useEffect(() => {
    if (!visible) return;
    const debut = setTimeout(() => setNotif(0), 2200);
    const boucle = setInterval(() => setNotif((n) => (n + 1) % NOTIFS.length), 3200);
    return () => {
      clearTimeout(debut);
      clearInterval(boucle);
    };
  }, [visible]);

  // L'écran reste affiché jusqu'à ce que la personne entre
  function fermer() {
    setSortie(true);
    setTimeout(() => setVisible(false), 450);
  }

  if (!visible) return null;
  const heure = new Date().getHours();
  const salut = heure >= 18 || heure < 4 ? "Bonsoir" : "Bonjour";
  const n = notif >= 0 ? NOTIFS[notif] : null;

  return (
    <div className={`fixed inset-0 z-50 mx-auto max-w-md overflow-hidden transition-all duration-[450ms] lg:grid lg:max-w-none lg:place-items-center lg:bg-stone-900/50 lg:backdrop-blur-sm ${sortie ? "scale-[1.04] opacity-0" : "opacity-100"}`}>
      <section className="degrade-vert relative flex h-full flex-col overflow-hidden px-6 pb-8 pt-10 text-white lg:h-[min(820px,92vh)] lg:w-[460px] lg:rounded-[2rem] lg:shadow-2xl">
        <div className="motif absolute inset-0 opacity-70" />
        <span className="halo pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <span className="halo pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/[0.06]" style={{ animationDelay: "-3s" }} />
        <div className="bande-kente kente-defile absolute inset-x-0 top-0" />

        <div className="apparait relative flex items-center justify-between" style={{ animationDelay: "0ms" }}>
          <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl shadow-md" />
            Cotiz
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            <Drapeau /> Côte d’Ivoire
          </span>
        </div>

        <p className="apparait relative mt-9 text-base font-semibold text-emerald-50/85" style={{ animationDelay: "120ms" }}>
          {salut} {prenom(nom)},
        </p>
        <h1 className="apparait relative mt-1 text-[2rem] font-extrabold leading-[1.1] tracking-tight" style={{ animationDelay: "220ms" }}>
          Tes tontines et cotisations, <span className="text-orange-300">sans palabres.</span>
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

          <div className="apparait flotte rounded-3xl bg-white p-4 pt-5 text-stone-900 shadow-2xl shadow-emerald-950/40" style={{ animationDelay: "380ms" }}>
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
                  <span key={x} className={`pop grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[0.7rem] font-bold ${c}`} style={{ animationDelay: `${900 + i * 140}ms` }}>
                    {x}
                  </span>
                ))}
              </div>
              <span className="pop ml-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700" style={{ animationDelay: "1700ms" }}>
                <Check size={14} strokeWidth={2.25} /> 8 ont payé
              </span>
            </div>
          </div>
        </div>

        <div className="apparait relative mt-auto space-y-4 pt-8" style={{ animationDelay: "560ms" }}>
          <p className="text-center text-sm text-emerald-50/80">Tout le monde voit qui a payé. Personne ne garde l’argent seul.</p>
          <BoutonEmpreinte onEntrer={fermer} />
        </div>
      </section>
    </div>
  );
}
