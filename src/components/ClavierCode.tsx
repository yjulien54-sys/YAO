"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Delete, Fingerprint, Headset, Lock, ShieldCheck, X } from "lucide-react";
import { ESSAIS_MAX, aEmpreinte, activerEmpreinte, definirCode, empreinteDisponible, enregistrerNaissance, reinitialiserParNaissance, verifierCode, verifierEmpreinte } from "@/lib/verrou";
import { vibrer } from "@/lib/haptique";
import { SUPPORT_PHONE } from "@/lib/support";
import { waLink } from "@/lib/whatsapp";

type Mode = "creation" | "confirmation" | "saisie" | "ancien" | "oubli" | "empreinte" | "naissance";

/**
 * Panneau du code secret Cotiz.
 * - defini = false : création du code ; true : saisie du code.
 * - changement : on demande l'ancien code, puis le nouveau deux fois.
 */
export function ClavierCode({ uid, defini, changement, attenteInitiale = 0, activerApres, naissanceConnue, onOk, onFermer, onOubli, tel, nom = "", integre, sansEmpreinte }: {
  uid: string; defini: boolean; changement?: boolean; attenteInitiale?: number; activerApres?: boolean; naissanceConnue?: boolean; tel?: string; nom?: string;
  integre?: boolean; sansEmpreinte?: boolean;
  onOk: () => void; onFermer?: () => void; onOubli?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(changement ? "ancien" : defini ? "saisie" : "creation");
  const [code, setCode] = useState("");
  const [ancien, setAncien] = useState("");
  const [premier, setPremier] = useState("");
  const [erreur, setErreur] = useState("");
  const [secoue, setSecoue] = useState(false);
  const [attente, setAttente] = useState(attenteInitiale);
  const [occupe, setOccupe] = useState(false);
  const [bioDispo, setBioDispo] = useState(false);
  const [reinit, setReinit] = useState(false); // code effacé après vérification « code oublié »
  const [info, setInfo] = useState("");
  const [nomSaisi, setNomSaisi] = useState("");
  const [naissance, setNaissance] = useState("");
  const [indispo, setIndispo] = useState(false);
  const [bioActive, setBioActive] = useState(() => aEmpreinte(uid));

  useEffect(() => {
    empreinteDisponible().then(setBioDispo);
  }, []);

  async function parEmpreinte() {
    vibrer("touche");
    setOccupe(true);
    const ok = await verifierEmpreinte(uid);
    setOccupe(false);
    if (ok) {
      vibrer("ok");
      return onOk();
    }
    setErreur("Empreinte non reconnue. Tape ton code.");
    vibrer("erreur");
  }

  async function activer() {
    vibrer("touche");
    setOccupe(true);
    try {
      await activerEmpreinte(uid, nom, tel ?? "");
      setBioActive(true);
      vibrer("ok");
      onOk();
    } catch {
      setErreur("L’empreinte n’a pas pu être activée. Tu pourras réessayer dans ton profil.");
      vibrer("erreur");
    } finally {
      setOccupe(false);
    }
  }

  // Compte à rebours après trop d'erreurs
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  const echec = (msg: string) => {
    setErreur(msg);
    setSecoue(true);
    vibrer("erreur");
    setTimeout(() => {
      setSecoue(false);
      setCode("");
    }, 450);
  };

  async function complet(c: string) {
    if (mode === "ancien") {
      setAncien(c);
      setCode("");
      setErreur("");
      return setMode("creation");
    }
    if (mode === "creation") {
      setPremier(c);
      setCode("");
      setErreur("");
      return setMode("confirmation");
    }
    if (mode === "confirmation") {
      if (c !== premier) {
        setPremier("");
        setMode("creation");
        return echec("Les deux codes sont différents. Recommence.");
      }
      setOccupe(true);
      const r = await definirCode(uid, c, changement && !reinit ? ancien : undefined);
      setOccupe(false);
      if (!r.ok) {
        setPremier("");
        setAncien("");
        setMode(changement && !reinit ? "ancien" : "creation");
        return echec(r.erreur ?? "Le code n’a pas pu être enregistré.");
      }
      vibrer("ok");
      setInfo("");
      return suite();
    }
    if (mode === "saisie") {
      setOccupe(true);
      const r = await verifierCode(uid, c);
      setOccupe(false);
      if (r.ok) {
        vibrer("ok");
        // Appui sur « Empreinte » alors qu'elle n'est pas activée : on la propose après le code
        if (activerApres && !sansEmpreinte && bioDispo && !bioActive) return setMode("empreinte");
        return onOk();
      }
      if (r.attente) {
        setAttente(r.attente);
        return echec("Trop d’essais. Patiente une minute.");
      }
      echec(`Code incorrect. Encore ${r.restants} essai${r.restants > 1 ? "s" : ""}.`);
    }
  }

  // Après la création du code : date de naissance (si inconnue), puis proposition d'empreinte
  function suite(depuis: Mode = "confirmation") {
    if (depuis === "confirmation" && !changement && naissanceConnue === false) return setMode("naissance");
    if (!changement && !sansEmpreinte && bioDispo && !bioActive) return setMode("empreinte");
    onOk();
  }

  async function enregistrerDate() {
    if (!naissance) return setErreur("Choisis ta date de naissance.");
    setOccupe(true);
    await enregistrerNaissance(naissance);
    setOccupe(false);
    vibrer("ok");
    setErreur("");
    suite("naissance");
  }

  // Code oublié : nom + date de naissance vérifiés par le serveur, instantanément
  async function verifierIdentite(e: React.FormEvent) {
    e.preventDefault();
    if (!nomSaisi.trim() || !naissance) return setErreur("Remplis ton nom et ta date de naissance.");
    setOccupe(true);
    const r = await reinitialiserParNaissance(uid, nomSaisi.trim(), naissance);
    setOccupe(false);
    if (r.ok) {
      vibrer("ok");
      setReinit(true);
      setErreur("");
      setCode("");
      setPremier("");
      setAttente(0);
      setInfo("Identité vérifiée ✓ Choisis ton nouveau code.");
      return setMode("creation");
    }
    vibrer("erreur");
    if (r.raison === "indisponible" || r.raison === "sans_naissance") {
      setIndispo(true);
      return setErreur(r.raison === "sans_naissance" ? "Aucune date de naissance n’est enregistrée sur ton compte." : "");
    }
    if (r.raison === "reseau") return setErreur("Pas de connexion. Réessaie quand tu as du réseau.");
    if (r.raison === "bloquee") return setErreur("Trop d’essais aujourd’hui. Réessaie demain ou contacte le service client.");
    setErreur(`Les informations ne correspondent pas. ${r.restants ? `Encore ${r.restants} essai${(r.restants ?? 0) > 1 ? "s" : ""} aujourd’hui.` : "Plus d’essai aujourd’hui."}`);
  }

  // Sur ordinateur : on peut taper le code au clavier
  useEffect(() => {
    if (!["saisie", "creation", "confirmation", "ancien"].includes(mode)) return;
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea")) return;
      if (/^[0-9]$/.test(e.key)) touche(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  });

  function touche(t: string) {
    if (occupe || attente > 0 || code.length >= 4) return;
    vibrer("touche");
    setErreur("");
    const c = code + t;
    setCode(c);
    if (c.length === 4) setTimeout(() => complet(c), 120);
  }

  const titres: Record<Mode, [string, string]> = {
    ancien: ["Ton code actuel", "Tape d’abord ton code secret actuel."],
    creation: [changement || reinit ? "Nouveau code" : "Crée ton code secret", info || "4 chiffres pour ouvrir Cotiz. Ce n’est pas le code de ton téléphone."],
    confirmation: ["Confirme ton code", "Tape le même code une deuxième fois."],
    saisie: ["Entre ton code Cotiz", activerApres && !bioActive ? "Tape ton code une fois pour activer l’empreinte." : "Ton code secret à 4 chiffres pour accéder à tes groupes."],
    oubli: ["Code oublié ?", "Confirme ton identité pour créer un nouveau code."],
    naissance: ["Ta date de naissance", "Elle te permettra de récupérer ton code si tu l’oublies. Elle ne pourra plus être changée."],
    empreinte: ["Activer l’empreinte ?", "Entre aussi avec ton doigt. Ton code Cotiz reste valable."],
  };
  const [titre, sous] = titres[mode];
  const fermable = (!!onFermer && !integre && (mode === "saisie" || changement)) || mode === "oubli";

  return (
    <div className={integre ? "w-full" : "absolute inset-0 z-20 flex flex-col justify-end bg-black/30 backdrop-blur-[2px]"} onClick={!integre && fermable && mode !== "oubli" ? onFermer : undefined}>
      <div className={integre ? "w-full text-stone-900" : "feuille rounded-t-[28px] bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-stone-900 shadow-2xl"} onClick={(e) => e.stopPropagation()}>
        {!integre && <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              {mode === "oubli" ? <ShieldCheck size={22} strokeWidth={1.9} /> : mode === "naissance" ? <CalendarDays size={22} strokeWidth={1.9} /> : mode === "empreinte" ? <Fingerprint size={22} strokeWidth={1.9} /> : <Lock size={21} strokeWidth={2} />}
            </span>
            <div>
              <p className="text-lg font-extrabold leading-tight">{titre}</p>
              {sous && <p className="text-[0.8125rem] leading-snug text-stone-500">{sous}</p>}
            </div>
          </div>
          {fermable && (
            <button type="button" onClick={mode === "oubli" ? () => { setErreur(""); setMode(changement && !reinit ? "ancien" : "saisie"); } : onFermer} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500">
              <X size={18} strokeWidth={2} />
            </button>
          )}
        </div>

        {mode === "empreinte" ? (
          <div className="mt-6 space-y-2.5">
            <button type="button" disabled={occupe} onClick={activer} className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 py-3.5 text-[0.95rem] font-bold text-white disabled:opacity-60">
              <Fingerprint size={20} strokeWidth={2} /> {occupe ? "Pose ton doigt…" : "Activer l’empreinte"}
            </button>
            <button type="button" onClick={() => { vibrer("touche"); onOk(); }} className="w-full rounded-[14px] py-3 text-sm font-semibold text-stone-500">Plus tard</button>
            {erreur && <p className="text-center text-sm font-medium text-red-600">{erreur}</p>}
          </div>
        ) : mode === "naissance" ? (
          <div className="mt-5 space-y-3">
            <input type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full rounded-[14px] border border-stone-300/80 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" aria-label="Date de naissance" />
            {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
            <button type="button" disabled={occupe} onClick={enregistrerDate} className="w-full rounded-[14px] bg-emerald-700 py-3.5 text-[0.95rem] font-bold text-white disabled:opacity-60">{occupe ? "Enregistrement…" : "Enregistrer"}</button>
            <button type="button" onClick={() => { vibrer("touche"); suite("naissance"); }} className="w-full py-2 text-sm font-semibold text-stone-500">Plus tard</button>
          </div>
        ) : mode === "oubli" ? (
          <form onSubmit={verifierIdentite} className="mt-4 space-y-3 text-sm text-stone-600">
            <label className="block">
              <span className="mb-1 block font-semibold text-stone-700">Nom et prénom</span>
              <input value={nomSaisi} onChange={(e) => setNomSaisi(e.target.value)} autoComplete="name" placeholder="ex : Yao Kouassi" className="w-full rounded-[14px] border border-stone-300/80 bg-white px-4 py-3 text-base text-stone-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="mb-1 block font-semibold text-stone-700">Date de naissance</span>
              <input type="date" value={naissance} onChange={(e) => setNaissance(e.target.value)} max={new Date().toISOString().slice(0, 10)} className="w-full rounded-[14px] border border-stone-300/80 bg-white px-4 py-3 text-base text-stone-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
            </label>
            {erreur && <p className="font-medium text-red-600">{erreur}</p>}
            <button type="submit" disabled={occupe} className="w-full rounded-[14px] bg-emerald-700 py-3.5 text-[0.95rem] font-bold text-white disabled:opacity-60">{occupe ? "Vérification…" : "Valider"}</button>
            {indispo && (
              <a
                href={waLink(`Bonjour, j’ai oublié mon code secret Cotiz. Mon numéro de compte : ${tel ?? ""}. Pouvez-vous le réinitialiser ?`, SUPPORT_PHONE)}
                target="_blank"
                rel="noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-stone-100 py-3 font-bold text-stone-800"
              >
                <Headset size={18} strokeWidth={2} /> Contacter le service client
              </a>
            )}
            {onOubli && (
              <button type="button" onClick={onOubli} className="w-full py-1 text-xs font-semibold text-stone-400">
                Me déconnecter de ce téléphone
              </button>
            )}
          </form>
        ) : (
          <>
            {/* Les 4 points */}
            <div className={`mt-6 flex justify-center gap-4 ${secoue ? "secoue" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-4 w-4 rounded-full transition-all duration-150 ${i < code.length ? (erreur && secoue ? "scale-110 bg-red-500" : "scale-110 bg-emerald-600") : "bg-stone-200"}`} />
              ))}
            </div>
            <p className={`mt-3 min-h-[1.25rem] text-center text-sm font-medium ${erreur || attente > 0 ? "text-red-600" : "text-stone-400"}`}>
              {attente > 0 ? `Réessaie dans ${attente} s` : erreur || (mode === "saisie" ? `${ESSAIS_MAX} essais maximum` : occupe ? "Enregistrement…" : " ")}
            </p>

            {/* Clavier */}
            <div className="mx-auto mt-2 grid max-w-[300px] grid-cols-3 gap-x-6 gap-y-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
                <Touche key={t} onClick={() => touche(t)} disabled={attente > 0}>{t}</Touche>
              ))}
              {mode === "saisie" && !sansEmpreinte && bioActive && bioDispo ? (
                <Touche onClick={parEmpreinte} label="Entrer avec l’empreinte" discret><Fingerprint size={28} strokeWidth={1.8} className="text-emerald-700" /></Touche>
              ) : (
                <span />
              )}
              <Touche onClick={() => touche("0")} disabled={attente > 0}>0</Touche>
              <Touche onClick={() => { vibrer("touche"); setCode((c) => c.slice(0, -1)); }} label="Effacer" discret><Delete size={24} strokeWidth={1.8} /></Touche>
            </div>

            {(mode === "saisie" || mode === "ancien") && (
              <button type="button" onClick={() => { vibrer("touche"); setMode("oubli"); }} className="mx-auto mt-3 block text-sm font-semibold text-emerald-700">Code oublié ?</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Touche({ children, onClick, disabled, label, discret }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string; discret?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onPointerDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      onClick={(e) => { if (e.detail === 0) onClick(); }}
      className={`mx-auto grid h-[62px] w-[62px] select-none [touch-action:manipulation] place-items-center rounded-full text-[1.6rem] font-semibold transition active:scale-90 disabled:opacity-30 ${discret ? "text-stone-500 active:bg-stone-100" : "bg-stone-100 text-stone-900 active:bg-emerald-100"}`}
    >
      {children}
    </button>
  );
}
