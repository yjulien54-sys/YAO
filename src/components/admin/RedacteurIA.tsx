"use client";

/**
 * Pour les agents : « Rédiger avec Cotiz IA ».
 * L'agent écrit ou DICTE (micro) ce qu'il veut dire au client ; Cotiz IA rédige un message
 * professionnel qui arrive dans la zone de réponse. L'agent relit, corrige, puis envoie lui-même.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Sparkles, X } from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

type Reco = { lang: string; continuous: boolean; interimResults: boolean; start: () => void; stop: () => void; onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null };

/** Dictée vocale en français (Chrome, Edge, Android ; Safari récent). Renvoie null si le navigateur ne sait pas faire. */
export function useDictee(ajouter: (texte: string) => void) {
  const [ecoute, setEcoute] = useState(false);
  const [dispo, setDispo] = useState(false);
  const [erreur, setErreur] = useState("");
  const reco = useRef<Reco | null>(null);
  const cb = useRef(ajouter);
  cb.current = ajouter;
  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Reco; webkitSpeechRecognition?: new () => Reco };
    setDispo(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => reco.current?.stop();
  }, []);
  const basculer = () => {
    if (ecoute) { reco.current?.stop(); return; }
    const w = window as unknown as { SpeechRecognition?: new () => Reco; webkitSpeechRecognition?: new () => Reco };
    const C = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!C) return setErreur("La dictée vocale n’est pas disponible sur ce navigateur (utilisez Chrome).");
    const r = new C();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) cb.current(e.results[i][0].transcript.trim());
    };
    r.onerror = (e) => setErreur(e.error === "not-allowed" ? "Autorisez le micro pour ce site (icône à gauche de l’adresse)." : "Le micro s’est arrêté. Réessayez.");
    r.onend = () => setEcoute(false);
    reco.current = r;
    setErreur("");
    r.start();
    setEcoute(true);
  };
  return { ecoute, dispo, erreur, basculer };
}

/** Bouton micro rond, réutilisable (zone de réponse, consigne…) */
export function BoutonMicro({ dictee, petit = false }: { dictee: ReturnType<typeof useDictee>; petit?: boolean }) {
  if (!dictee.dispo) return null;
  return (
    <button type="button" onClick={dictee.basculer} title={dictee.ecoute ? "Arrêter la dictée" : "Dicter à la voix"} aria-label={dictee.ecoute ? "Arrêter la dictée" : "Dicter à la voix"}
      className={`relative grid shrink-0 place-items-center rounded-full transition ${petit ? "h-9 w-9" : "h-11 w-11"} ${dictee.ecoute ? "bg-red-600 text-white shadow-lg shadow-red-600/30" : "bg-stone-100 text-stone-700 hover:bg-stone-200"}`}>
      {dictee.ecoute && <span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" />}
      {dictee.ecoute ? <MicOff size={petit ? 16 : 18} className="relative" /> : <Mic size={petit ? 16 : 18} />}
    </button>
  );
}

export function RedacteurIA({ nom, motif, messages, onTexte }: { nom: string | null; motif: string; messages: { auteur: string; texte: string }[]; onTexte: (t: string) => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [consigne, setConsigne] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");
  const dictee = useDictee((t) => setConsigne((c) => (c ? `${c} ${t}` : t)));

  const rediger = async () => {
    if (!consigne.trim()) return setMsg("Dites ou écrivez ce que vous voulez répondre.");
    setOccupe(true); setMsg("");
    if (dictee.ecoute) dictee.basculer();
    const { data } = await db.auth.getSession();
    const res = await fetch("/api/service-client/brouillon", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ consigne, nom, motif, messages }),
    }).catch(() => null);
    const r = (await res?.json().catch(() => null)) as { ok?: boolean; texte?: string; raison?: string } | null;
    setOccupe(false);
    if (!r?.ok || !r.texte) return setMsg(r?.raison ?? "Cotiz IA n’a pas pu rédiger. Réessayez.");
    onTexte(r.texte);
    setConsigne("");
    setOuvert(false);
  };

  if (!ouvert) {
    return (
      <button type="button" onClick={() => setOuvert(true)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-bold text-white shadow-sm">
        <Sparkles size={15} /> Rédiger avec Cotiz IA
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-violet-50 p-3 ring-1 ring-violet-200">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-bold text-violet-900"><Sparkles size={15} /> Que voulez-vous répondre ?</p>
        <button type="button" onClick={() => { setOuvert(false); if (dictee.ecoute) dictee.basculer(); }} aria-label="Fermer" className="grid h-7 w-7 place-items-center rounded-full text-violet-700 hover:bg-violet-100"><X size={15} /></button>
      </div>
      <div className="flex items-start gap-2">
        <textarea value={consigne} onChange={(e) => setConsigne(e.target.value)} rows={3}
          placeholder={dictee.dispo ? "Ex : dis-lui que son paiement de 5 000 F a bien été confirmé par le trésorier… (ou touchez le micro et parlez)" : "Ex : dis-lui que son paiement de 5 000 F a bien été confirmé par le trésorier…"}
          className="min-h-[76px] flex-1 resize-y rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100" />
        <BoutonMicro dictee={dictee} />
      </div>
      {dictee.ecoute && <p className="text-xs font-semibold text-red-600">● Je vous écoute… parlez normalement, puis touchez le micro pour arrêter.</p>}
      {(dictee.erreur || msg) && <p className="text-xs font-medium text-red-600">{dictee.erreur || msg}</p>}
      <button type="button" disabled={occupe} onClick={rediger} className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-violet-700 py-2.5 text-sm font-bold text-white disabled:opacity-60">
        {occupe ? <><Loader2 size={15} className="animate-spin" /> Rédaction…</> : <><Sparkles size={15} /> Rédiger le message</>}
      </button>
      <p className="text-[0.7rem] text-violet-800/80">Le message arrive dans la zone de réponse : relisez-le et corrigez-le avant d’envoyer. Rien n’est envoyé sans vous.</p>
    </div>
  );
}
