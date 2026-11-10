"use client";

import { useEffect, useState } from "react";
import { Delete, Fingerprint, Headset, Lock, ShieldCheck, X } from "lucide-react";
import { ESSAIS_MAX, aEmpreinte, activerEmpreinte, definirCode, empreinteDisponible, verifierCode, verifierEmpreinte } from "@/lib/verrou";
import { vibrer } from "@/lib/haptique";
import { SUPPORT_PHONE } from "@/lib/support";
import { waLink } from "@/lib/whatsapp";

type Mode = "creation" | "confirmation" | "saisie" | "ancien" | "oubli" | "empreinte";

/**
 * Panneau du code secret Cotiz.
 * - defini = false : création du code ; true : saisie du code.
 * - changement : on demande l'ancien code, puis le nouveau deux fois.
 */
export function ClavierCode({ uid, defini, changement, attenteInitiale = 0, activerApres, onOk, onFermer, onOubli, tel, nom = "" }: {
  uid: string; defini: boolean; changement?: boolean; attenteInitiale?: number; activerApres?: boolean; tel?: string; nom?: string;
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
      const r = await definirCode(uid, c, changement ? ancien : undefined);
      setOccupe(false);
      if (!r.ok) {
        setPremier("");
        setAncien("");
        setMode(changement ? "ancien" : "creation");
        return echec(r.erreur ?? "Le code n’a pas pu être enregistré.");
      }
      vibrer("ok");
      // Première création : on propose l'empreinte si le téléphone en a une
      if (!changement && bioDispo && !bioActive) return setMode("empreinte");
      return onOk();
    }
    if (mode === "saisie") {
      setOccupe(true);
      const r = await verifierCode(uid, c);
      setOccupe(false);
      if (r.ok) {
        vibrer("ok");
        // Appui sur « Empreinte » alors qu'elle n'est pas activée : on la propose après le code
        if (activerApres && bioDispo && !bioActive) return setMode("empreinte");
        return onOk();
      }
      if (r.attente) {
        setAttente(r.attente);
        return echec("Trop d’essais. Patiente une minute.");
      }
      echec(`Code incorrect. Encore ${r.restants} essai${r.restants > 1 ? "s" : ""}.`);
    }
  }

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
    creation: [changement ? "Nouveau code" : "Crée ton code secret", "4 chiffres pour ouvrir Cotiz. Ce n’est pas le code de ton téléphone."],
    confirmation: ["Confirme ton code", "Tape le même code une deuxième fois."],
    saisie: ["Entre ton code Cotiz", activerApres && !bioActive ? "Tape ton code une fois pour activer l’empreinte." : "Ton code secret à 4 chiffres pour accéder à tes groupes."],
    oubli: ["Code oublié ?", ""],
    empreinte: ["Activer l’empreinte ?", "Entre aussi avec ton doigt. Ton code Cotiz reste valable."],
  };
  const [titre, sous] = titres[mode];
  const fermable = !!onFermer && (mode === "saisie" || mode === "oubli" || changement);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/30 backdrop-blur-[2px]" onClick={fermable && mode !== "oubli" ? onFermer : undefined}>
      <div className="feuille rounded-t-[28px] bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-stone-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              {mode === "oubli" ? <ShieldCheck size={22} strokeWidth={1.9} /> : mode === "empreinte" ? <Fingerprint size={22} strokeWidth={1.9} /> : <Lock size={21} strokeWidth={2} />}
            </span>
            <div>
              <p className="text-lg font-extrabold leading-tight">{titre}</p>
              {sous && <p className="text-[0.8125rem] leading-snug text-stone-500">{sous}</p>}
            </div>
          </div>
          {fermable && (
            <button type="button" onClick={mode === "oubli" ? () => setMode("saisie") : onFermer} aria-label="Fermer" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-500">
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
        ) : mode === "oubli" ? (
          <div className="mt-4 space-y-3 text-sm text-stone-600">
            <p>Pour ta sécurité, personne ne peut lire ton code, même pas l’équipe Cotiz. Le service client peut le <b>réinitialiser</b> après avoir vérifié ton identité. Tu en créeras alors un nouveau.</p>
            <a
              href={waLink(`Bonjour, j’ai oublié mon code secret Cotiz. Mon numéro de compte : ${tel ?? ""}. Pouvez-vous le réinitialiser ?`, SUPPORT_PHONE)}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 py-3.5 text-[0.95rem] font-bold text-white"
            >
              <Headset size={18} strokeWidth={2} /> Contacter le service client
            </a>
            {onOubli && (
              <button type="button" onClick={onOubli} className="w-full rounded-[14px] py-2.5 text-sm font-semibold text-stone-500">
                Ou me déconnecter de ce téléphone
              </button>
            )}
          </div>
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
              {mode === "saisie" && bioActive && bioDispo ? (
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
