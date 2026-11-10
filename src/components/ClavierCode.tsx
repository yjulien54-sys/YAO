"use client";

import { useEffect, useState } from "react";
import { Delete, Fingerprint, Lock, ShieldCheck, X } from "lucide-react";
import { ESSAIS_MAX, activerEmpreinte, aEmpreinte, aUnCode, attenteRestante, definirCode, empreinteDisponible, verifierCode, verifierEmpreinte } from "@/lib/verrou";

type Mode = "creation" | "confirmation" | "saisie" | "empreinte" | "oubli";

const vibrer = (ms: number | number[]) => {
  try { navigator.vibrate?.(ms); } catch {}
};

/** Panneau du code secret (création, saisie, empreinte, code oublié) */
export function ClavierCode({ uid, nom, tel, onOk, onFermer, onOubli }: { uid: string; nom: string; tel: string; onOk: () => void; onFermer: () => void; onOubli: () => void }) {
  const [mode, setMode] = useState<Mode>(aUnCode(uid) ? "saisie" : "creation");
  const [code, setCode] = useState("");
  const [premier, setPremier] = useState("");
  const [erreur, setErreur] = useState("");
  const [secoue, setSecoue] = useState(false);
  const [attente, setAttente] = useState(() => attenteRestante(uid));
  const [bioDispo, setBioDispo] = useState(false);
  const [occupe, setOccupe] = useState(false);

  useEffect(() => {
    empreinteDisponible().then(setBioDispo);
  }, []);

  // Compte à rebours après trop d'erreurs
  useEffect(() => {
    if (!attente) return;
    const t = setInterval(() => setAttente(attenteRestante(uid)), 1000);
    return () => clearInterval(t);
  }, [attente, uid]);

  const echec = (msg: string) => {
    setErreur(msg);
    setSecoue(true);
    vibrer([40, 60, 40]);
    setTimeout(() => {
      setSecoue(false);
      setCode("");
    }, 450);
  };

  async function complet(c: string) {
    if (mode === "creation") {
      setPremier(c);
      setCode("");
      setErreur("");
      setMode("confirmation");
      return;
    }
    if (mode === "confirmation") {
      if (c !== premier) {
        setPremier("");
        setMode("creation");
        return echec("Les deux codes sont différents. Recommence.");
      }
      setOccupe(true);
      await definirCode(uid, c);
      setOccupe(false);
      vibrer(30);
      if (bioDispo) return setMode("empreinte");
      return onOk();
    }
    if (mode === "saisie") {
      setOccupe(true);
      const r = await verifierCode(uid, c);
      setOccupe(false);
      if (r.ok) {
        vibrer(30);
        return onOk();
      }
      if (r.restants === 0) {
        setAttente(attenteRestante(uid));
        return echec("Trop d’essais. Patiente une minute.");
      }
      echec(`Code incorrect. Encore ${r.restants} essai${r.restants > 1 ? "s" : ""}.`);
    }
  }

  function touche(t: string) {
    if (occupe || attente || code.length >= 4) return;
    vibrer(10);
    setErreur("");
    const c = code + t;
    setCode(c);
    if (c.length === 4) setTimeout(() => complet(c), 120);
  }

  async function essayerEmpreinte() {
    setOccupe(true);
    const ok = await verifierEmpreinte(uid);
    setOccupe(false);
    if (ok) {
      vibrer(30);
      onOk();
    } else setErreur("Empreinte non reconnue. Tape ton code.");
  }

  async function activer() {
    setOccupe(true);
    try {
      await activerEmpreinte(uid, nom, tel);
      vibrer(30);
      onOk();
    } catch {
      setErreur("L’empreinte n’a pas pu être activée. Tu pourras réessayer dans ton profil.");
    } finally {
      setOccupe(false);
    }
  }

  const titres: Record<Mode, [string, string]> = {
    creation: ["Crée ton code secret", "4 chiffres que toi seul connais. Il protège ton argent."],
    confirmation: ["Confirme ton code", "Tape le même code une deuxième fois."],
    saisie: ["Entre ton code secret", "Pour accéder à tes groupes et à ton argent."],
    empreinte: ["Activer l’empreinte ?", "Entre plus vite avec ton doigt ou ton visage. Ton code reste valable."],
    oubli: ["Code oublié ?", ""],
  };
  const [titre, sous] = titres[mode];

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/30 backdrop-blur-[2px]" onClick={mode === "saisie" ? onFermer : undefined}>
      <div className="feuille rounded-t-[28px] bg-white px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 text-stone-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
              {mode === "empreinte" ? <Fingerprint size={22} strokeWidth={1.9} /> : mode === "oubli" ? <ShieldCheck size={22} strokeWidth={1.9} /> : <Lock size={21} strokeWidth={2} />}
            </span>
            <div>
              <p className="text-lg font-extrabold leading-tight">{titre}</p>
              {sous && <p className="text-[0.8125rem] leading-snug text-stone-500">{sous}</p>}
            </div>
          </div>
          {(mode === "saisie" || mode === "oubli") && (
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
            <button type="button" onClick={onOk} className="w-full rounded-[14px] py-3 text-sm font-semibold text-stone-500">Plus tard</button>
            {erreur && <p className="text-center text-sm font-medium text-red-600">{erreur}</p>}
          </div>
        ) : mode === "oubli" ? (
          <div className="mt-4 space-y-3 text-sm text-stone-600">
            <p>Pour ta sécurité, le code ne peut pas être affiché. Tu dois te <b>reconnecter avec ton numéro</b>, puis créer un nouveau code.</p>
            <p className="rounded-xl bg-amber-50 p-3 text-amber-900">Après la reconnexion, rouvre le lien d’invitation de chacun de tes groupes pour les retrouver, ou contacte le service client.</p>
            <button type="button" onClick={onOubli} className="w-full rounded-[14px] bg-stone-900 py-3.5 text-[0.95rem] font-bold text-white">Me reconnecter</button>
          </div>
        ) : (
          <>
            {/* Les 4 points */}
            <div className={`mt-6 flex justify-center gap-4 ${secoue ? "secoue" : ""}`}>
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`h-4 w-4 rounded-full transition-all duration-150 ${i < code.length ? (erreur && secoue ? "scale-110 bg-red-500" : "scale-110 bg-emerald-600") : "bg-stone-200"}`} />
              ))}
            </div>
            <p className={`mt-3 min-h-[1.25rem] text-center text-sm font-medium ${erreur ? "text-red-600" : "text-stone-400"}`}>
              {attente ? `Réessaie dans ${attente} s` : erreur || (mode === "saisie" ? `${ESSAIS_MAX} essais maximum` : " ")}
            </p>

            {/* Clavier */}
            <div className="mx-auto mt-2 grid max-w-[300px] grid-cols-3 gap-x-6 gap-y-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((t) => (
                <Touche key={t} onClick={() => touche(t)} disabled={!!attente}>{t}</Touche>
              ))}
              {mode === "saisie" && aEmpreinte(uid) && bioDispo ? (
                <Touche onClick={essayerEmpreinte} label="Utiliser l’empreinte" discret><Fingerprint size={26} strokeWidth={1.8} className="text-emerald-700" /></Touche>
              ) : (
                <span />
              )}
              <Touche onClick={() => touche("0")} disabled={!!attente}>0</Touche>
              <Touche onClick={() => { vibrer(10); setCode((c) => c.slice(0, -1)); }} label="Effacer" discret><Delete size={24} strokeWidth={1.8} /></Touche>
            </div>

            {mode === "saisie" && (
              <button type="button" onClick={() => setMode("oubli")} className="mx-auto mt-3 block text-sm font-semibold text-emerald-700">Code oublié ?</button>
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
      onClick={onClick}
      className={`mx-auto grid h-[62px] w-[62px] place-items-center rounded-full text-[1.6rem] font-semibold transition active:scale-90 disabled:opacity-30 ${discret ? "text-stone-500 active:bg-stone-100" : "bg-stone-100 text-stone-900 active:bg-emerald-100"}`}
    >
      {children}
    </button>
  );
}
