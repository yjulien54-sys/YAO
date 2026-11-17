"use client";

/**
 * Installation sur iPhone : Apple ne permet pas d'installer un fichier comme sur Android.
 * On installe Sikaklo depuis Safari : Partager → « Sur l'écran d'accueil ».
 * Si le lien est ouvert dans WhatsApp, Facebook… (pas de bouton d'installation),
 * on explique d'abord comment l'ouvrir dans Safari.
 */
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, Copy, Compass, MoreHorizontal, PlusSquare, Share, X } from "lucide-react";

export type Appareil = { ios: boolean; installee: boolean; dansUneAppli: boolean; safari: boolean };

export function detecterAppareil(): Appareil {
  if (typeof window === "undefined") return { ios: false, installee: false, dansUneAppli: false, safari: false };
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const installee = (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.("(display-mode: standalone)").matches;
  // Navigateur intégré (WhatsApp, Facebook, Instagram, TikTok…) : pas de jeton « Safari » dans l'identité du navigateur
  const dansUneAppli = ios && (/FBAN|FBAV|Instagram|WhatsApp|Line\/|Snapchat|TikTok|musical_ly|Bytedance|GSA\//i.test(ua) || !/Safari\//i.test(ua));
  const safari = ios && !dansUneAppli && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
  return { ios, installee: !!installee, dansUneAppli, safari };
}

const CLE = "sikaklo:install-iphone-vu";

/** Petit bandeau en bas de l'écran, sur iPhone seulement, tant que Sikaklo n'est pas installée */
export function BandeauIPhone() {
  const chemin = usePathname();
  const [a, setA] = useState<Appareil | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [cache, setCache] = useState(true);

  useEffect(() => {
    const d = detecterAppareil();
    setA(d);
    let vu = 0;
    try { vu = Number(localStorage.getItem(CLE) || 0); } catch {}
    // Réaffiché après 3 jours si la personne l'a fermé
    setCache(!d.ios || d.installee || Date.now() - vu < 3 * 86_400_000);
  }, []);

  // Pas sur les pages publiques (cagnotte, reçu) : les donateurs n'ont pas besoin d'installer
  if (!a || cache || /^\/(c|r|admin)\//.test(chemin ?? "") || chemin === "/telecharger") return null;
  const fermer = () => { try { localStorage.setItem(CLE, String(Date.now())); } catch {} setCache(true); };

  return (
    <>
      <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] flex items-center gap-3 rounded-2xl bg-stone-900 p-3 text-white shadow-2xl lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
        <button type="button" onClick={() => setOuvert(true)} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-bold">Installer Sikaklo sur votre iPhone</span>
          <span className="block text-xs text-white/70">2 étapes, 10 secondes · gratuit</span>
        </button>
        <button type="button" onClick={() => setOuvert(true)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-extrabold">Voir</button>
        <button type="button" onClick={fermer} aria-label="Fermer" className="grid h-7 w-7 place-items-center rounded-full bg-white/10"><X size={14} /></button>
      </div>
      {ouvert && <GuideIPhone appareil={a} fermer={() => { setOuvert(false); fermer(); }} />}
    </>
  );
}

/** Le guide pas à pas (utilisé par le bandeau et la page Télécharger) */
export function GuideIPhone({ appareil, fermer }: { appareil: Appareil; fermer?: () => void }) {
  const [copie, setCopie] = useState(false);
  const lien = typeof window !== "undefined" ? window.location.origin : "https://www.sikaklo.com";
  const copier = async () => {
    try { await navigator.clipboard.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch {}
  };

  const contenu = (
    <div className="space-y-4">
      {appareil.dansUneAppli && (
        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
          <p className="font-bold text-amber-900">⚠️ D’abord, ouvrez Sikaklo dans Safari</p>
          <p className="mt-1 text-sm text-amber-900/80">Vous êtes dans WhatsApp (ou une autre application) : l’iPhone n’y permet pas l’installation.</p>
          <ol className="mt-3 space-y-2 text-sm text-amber-950">
            <li className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">1</span>
              <span>Touchez <b>les 3 points</b> <MoreHorizontal size={15} className="inline" /> ou <b>l’icône boussole</b> <Compass size={15} className="inline" />, puis <b>« Ouvrir dans Safari »</b>.</span></li>
            <li className="flex items-start gap-2"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-500 text-xs font-bold text-white">2</span>
              <span>Si vous ne trouvez pas : copiez le lien, ouvrez <b>Safari</b> et collez-le dans la barre d’adresse.</span></li>
          </ol>
          <button type="button" onClick={copier} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-sm font-extrabold text-white">
            {copie ? <><Check size={16} /> Lien copié : collez-le dans Safari</> : <><Copy size={16} /> Copier le lien de Sikaklo</>}
          </button>
        </div>
      )}

      <div className={appareil.dansUneAppli ? "opacity-60" : ""}>
        <p className="font-bold text-stone-900">{appareil.dansUneAppli ? "Ensuite, dans Safari :" : "Dans Safari :"}</p>
        <ol className="mt-3 space-y-3">
          <li className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">1</span>
            <span className="flex-1 text-sm text-stone-700">Touchez le bouton <b>Partager</b>, en bas de l’écran (ou en haut sur iPad).</span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-sky-600 shadow ring-1 ring-stone-200"><Share size={22} /></span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-stone-50 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">2</span>
            <span className="flex-1 text-sm text-stone-700">Faites défiler et touchez <b>« Sur l’écran d’accueil »</b>, puis <b>Ajouter</b> en haut à droite.</span>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-stone-700 shadow ring-1 ring-stone-200"><PlusSquare size={22} /></span>
          </li>
          <li className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-xl" />
            <span className="flex-1 text-sm font-semibold text-emerald-900">C’est installé ! Ouvrez Sikaklo depuis son icône, comme une vraie application.</span>
          </li>
        </ol>
        <p className="mt-3 text-xs text-stone-500">« Sur l’écran d’accueil » n’apparaît pas ? Faites glisser la liste vers le haut, ou touchez <b>« Modifier les actions »</b> tout en bas pour l’ajouter.</p>
      </div>
    </div>
  );

  if (!fermer) return contenu;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 backdrop-blur-[2px]" onClick={fermer}>
      <div className="feuille max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 rounded-2xl" />
          <div className="flex-1">
            <p className="text-lg font-extrabold">Installer Sikaklo</p>
            <p className="text-xs text-stone-500">Sur iPhone, l’installation se fait depuis Safari</p>
          </div>
          <button type="button" onClick={fermer} aria-label="Fermer" className="grid h-9 w-9 place-items-center rounded-full bg-stone-100 text-stone-500"><X size={18} /></button>
        </div>
        {contenu}
      </div>
    </div>
  );
}
