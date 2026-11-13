"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Clock, Lock, MessageSquareText, Send, Star } from "lucide-react";
import { IconBadge } from "./icons";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";

const MOTIFS = ["Un paiement", "Mon compte / mon code", "Un groupe", "Un versement", "Une arnaque / un problème grave", "Une suggestion", "Autre"];
type Requete = { id: string; numero: number; cree_le: string; motif: string; message: string; statut: "nouvelle" | "en_cours" | "resolue"; reponse: string | null; dernier_auteur?: string | null; note?: number | null; avis?: string | null };
type Msg = { id: string; requete_id: string; cree_le: string; auteur: "client" | "agent"; texte: string };
const STATUT: Record<Requete["statut"], [string, string]> = {
  nouvelle: ["Envoyée", "bg-amber-50 text-amber-800"],
  en_cours: ["En cours", "bg-sky-50 text-sky-700"],
  resolue: ["Fermée", "bg-stone-100 text-stone-600"],
};

/** Écrire au service client depuis l'application, et suivre ses demandes */
export function RequeteClient() {
  const { userId } = useStore();
  const [liste, setListe] = useState<Requete[] | null>(null);
  const [dispo, setDispo] = useState(true);
  const [motif, setMotif] = useState("");
  const [message, setMessage] = useState("");
  const [etat, setEtat] = useState<"" | "envoi" | "ok">("");
  const [erreur, setErreur] = useState("");
  const [msgs, setMsgs] = useState<Msg[] | null>(null); // null : mise à jour SQL n°33 pas encore faite
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!userId) return;
    const lire = (cols: string) => supabase.from("requetes_clients").select(cols).order("cree_le", { ascending: false }).limit(20);
    let { data, error } = await lire("id, numero, cree_le, motif, message, statut, reponse, dernier_auteur, note, avis");
    if (error) ({ data, error } = await lire("id, numero, cree_le, motif, message, statut, reponse, dernier_auteur"));
    if (error) ({ data, error } = await lire("id, numero, cree_le, motif, message, statut, reponse"));
    if (error) return setDispo(false); // mise à jour SQL n°18 pas encore faite
    const l = (data as unknown as Requete[]) ?? [];
    setListe(l);
    if (l.length) {
      const m = await supabase.from("requetes_messages").select("id, requete_id, cree_le, auteur, texte").in("requete_id", l.map((r) => r.id)).order("cree_le");
      setMsgs(m.error ? null : ((m.data as Msg[]) ?? []));
    }
    setOuverte((o) => o ?? l.find((r) => r.statut !== "resolue")?.id ?? null);
  }, [userId]);
  useEffect(() => { charger(); }, [charger]);
  // Nouvelles réponses : on regarde toutes les 20 secondes tant qu'une conversation est ouverte
  useEffect(() => {
    if (!liste?.some((r) => r.statut !== "resolue")) return;
    const t = setInterval(charger, 20000);
    const f = () => charger();
    window.addEventListener("focus", f);
    return () => { clearInterval(t); window.removeEventListener("focus", f); };
  }, [liste, charger]);

  if (!userId || !dispo) return null;

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!motif) return setErreur("Choisis le sujet de ton message.");
    if (message.trim().length < 5) return setErreur("Explique ton problème en quelques mots.");
    setEtat("envoi"); setErreur("");
    const { error } = await supabase.from("requetes_clients").insert({ motif, message: message.trim() });
    if (error) { setEtat(""); return setErreur(error.message.includes("plusieurs messages") ? error.message : "Envoi impossible. Réessaie dans un instant."); }
    setEtat("ok"); setMotif(""); setMessage("");
    charger();
  }

  return (
    <section id="mes-requetes" className="carte scroll-mt-20 space-y-4 p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={MessageSquareText} ton="bleu" />
        <div>
          <p className="font-bold">Écrire au service client</p>
          <p className="text-xs text-stone-500">Un agent te répond ici et tu reçois une notification.</p>
        </div>
      </div>
      {etat === "ok" ? (
        <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={18} /> Message envoyé</p>
          <p className="mt-1">Un agent du service client va te répondre. Tu verras sa réponse juste en dessous.</p>
          <button onClick={() => setEtat("")} className="mt-2 text-xs font-bold underline">Écrire un autre message</button>
        </div>
      ) : (
        <form onSubmit={envoyer} className="space-y-3">
          <select value={motif} onChange={(e) => setMotif(e.target.value)} className={`w-full rounded-[14px] border border-stone-300/80 bg-white px-3 py-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${motif ? "" : "text-stone-400"}`}>
            <option value="">Sujet de ton message…</option>
            {MOTIFS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} maxLength={2000} placeholder="Explique ce qui se passe : quel groupe, quel montant, quand…" className="w-full resize-y rounded-[14px] border border-stone-300/80 bg-white px-3 py-3 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
          {erreur && <p className="text-sm font-medium text-red-600">{erreur}</p>}
          <button disabled={etat === "envoi"} className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 py-3 text-sm font-bold text-white disabled:opacity-60"><Send size={16} /> {etat === "envoi" ? "Envoi…" : "Envoyer"}</button>
        </form>
      )}
      {liste && liste.length > 0 && (
        <div className="space-y-2 border-t border-stone-100 pt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Mes conversations</p>
          {liste.map((r) => {
            const [l, c] = STATUT[r.statut];
            const fil: Msg[] = msgs ? msgs.filter((m) => m.requete_id === r.id) : [
              { id: r.id + "c", requete_id: r.id, cree_le: r.cree_le, auteur: "client", texte: r.message },
              ...(r.reponse ? [{ id: r.id + "a", requete_id: r.id, cree_le: r.cree_le, auteur: "agent" as const, texte: r.reponse }] : []),
            ];
            const nouveau = r.statut !== "resolue" && r.dernier_auteur === "agent";
            return <Conversation key={r.id} r={r} fil={fil} statut={[l, c]} nouveau={nouveau} ouverte={ouverte === r.id} basculer={() => setOuverte(ouverte === r.id ? null : r.id)} peutEcrire={msgs !== null && r.statut !== "resolue"} envoye={charger} />;
          })}
        </div>
      )}
    </section>
  );
}

/** Une conversation avec le service client, en bulles, avec réponse dans le même fil */
function Conversation({ r, fil, statut: [l, c], nouveau, ouverte, basculer, peutEcrire, envoye }: { r: Requete; fil: Msg[]; statut: [string, string]; nouveau: boolean; ouverte: boolean; basculer: () => void; peutEcrire: boolean; envoye: () => void }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState("");
  const ecrire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) return;
    setEnvoi(true); setErr("");
    const { error } = await supabase.rpc("requete_ecrire", { r: r.id, texte: texte.trim() });
    setEnvoi(false);
    if (error) return setErr(error.message.includes("fermée") || error.message.includes("beaucoup") ? error.message : "Envoi impossible. Réessaie dans un instant.");
    setTexte("");
    envoye();
  };
  const heure = (d: string) => new Date(d).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return (
    <div className={`overflow-hidden rounded-2xl text-sm ring-1 ${nouveau ? "bg-emerald-50/60 ring-emerald-300" : "bg-stone-50 ring-stone-200/70"}`}>
      <button type="button" onClick={basculer} className="flex w-full items-center gap-2 p-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{r.motif}</span>
            {nouveau && <span className="shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-[0.65rem] font-bold text-white">Nouveau message</span>}
          </span>
          <span className="block truncate text-xs text-stone-500">{fil[fil.length - 1]?.auteur === "agent" ? "Service client : " : "Toi : "}{fil[fil.length - 1]?.texte}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${c}`}>{l}</span>
        <ChevronDown size={16} className={`shrink-0 text-stone-400 transition ${ouverte ? "rotate-180" : ""}`} />
      </button>
      {ouverte && (
        <div className="space-y-2 border-t border-stone-200/70 bg-white/70 p-3">
          {fil.map((m) => (
            <div key={m.id} className={`flex ${m.auteur === "client" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.auteur === "client" ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md bg-white text-stone-800 ring-1 ring-stone-200"}`}>
                {m.auteur === "agent" && <p className="text-[0.7rem] font-bold text-emerald-700">Service client</p>}
                <p className="whitespace-pre-line">{m.texte}</p>
                <p className={`mt-0.5 text-right text-[0.65rem] ${m.auteur === "client" ? "text-emerald-100" : "text-stone-400"}`}>{heure(m.cree_le)}</p>
              </div>
            </div>
          ))}
          {r.statut !== "resolue" && fil[fil.length - 1]?.auteur === "client" && (
            <p className="flex items-center justify-center gap-1 text-xs text-stone-400"><Clock size={12} /> Un agent va te répondre ici</p>
          )}
          {peutEcrire ? (
            <form onSubmit={ecrire} className="flex items-end gap-2 pt-1">
              <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} maxLength={2000} placeholder="Écrire dans cette conversation…"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }}
                className="min-h-[44px] flex-1 resize-none rounded-2xl border border-stone-300/80 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
              <button disabled={envoi || !texte.trim()} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-white disabled:opacity-40"><Send size={17} /></button>
            </form>
          ) : r.statut === "resolue" ? (
            <>
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-100 p-2 text-xs text-stone-500"><Lock size={12} /> Conversation fermée par le service client. Pour autre chose, écris un nouveau message ci-dessus.</p>
              {"note" in r && <Avis r={r} envoye={envoye} />}
            </>
          ) : null}
          {err && <p className="text-sm font-medium text-red-600">{err}</p>}
        </div>
      )}
    </div>
  );
}

/** Avis du client à la fin d'une conversation : 1 à 5 étoiles + commentaire ; 1 ou 2 étoiles → il peut rouvrir */
function Avis({ r, envoye }: { r: Requete; envoye: () => void }) {
  const [note, setNote] = useState(r.note ?? 0);
  const [survol, setSurvol] = useState(0);
  const [commentaire, setCommentaire] = useState(r.avis ?? "");
  const [rouvrir, setRouvrir] = useState(false);
  const [modifier, setModifier] = useState(!r.note);
  const [envoi, setEnvoi] = useState(false);
  const [err, setErr] = useState("");
  const MOTS = ["", "Très mauvais", "Mauvais", "Moyen", "Bien", "Excellent"];
  const valider = async () => {
    if (!note) return setErr("Choisis une note.");
    setEnvoi(true); setErr("");
    const { error } = await supabase.rpc("requete_noter", { r: r.id, note, commentaire: commentaire.trim() || null, rouvrir: rouvrir && note <= 2 });
    setEnvoi(false);
    if (error) return setErr(error.message);
    setModifier(false);
    envoye();
  };
  if (!modifier && r.note) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
        <span className="flex items-center gap-1.5">Ton avis : <span className="text-amber-500">{"★".repeat(r.note)}<span className="text-amber-200">{"★".repeat(5 - r.note)}</span></span> Merci !</span>
        <button onClick={() => setModifier(true)} className="font-bold underline">Modifier</button>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-2xl bg-gradient-to-br from-amber-50 to-white p-3 ring-1 ring-amber-200">
      <p className="text-center text-sm font-bold">Comment le service client t’a-t-il aidé ?</p>
      <div className="flex justify-center gap-1" onMouseLeave={() => setSurvol(0)}>
        {[1, 2, 3, 4, 5].map((k) => (
          <button key={k} type="button" onMouseEnter={() => setSurvol(k)} onClick={() => setNote(k)} aria-label={`${k} étoile${k > 1 ? "s" : ""}`} className="p-1 transition-transform active:scale-90">
            <Star size={30} className={k <= (survol || note) ? "fill-amber-400 text-amber-400" : "text-stone-300"} />
          </button>
        ))}
      </div>
      <p className="h-4 text-center text-xs font-semibold text-amber-800">{MOTS[survol || note]}</p>
      {note > 0 && (
        <>
          <textarea value={commentaire} onChange={(e) => setCommentaire(e.target.value)} rows={2} maxLength={500} placeholder={note <= 2 ? "Qu’est-ce qui n’a pas été ? (facultatif)" : "Un mot pour l’agent ? (facultatif)"} className="w-full resize-none rounded-xl border border-stone-300/80 bg-white px-3 py-2 text-base outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
          {note <= 2 && (
            <label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={rouvrir} onChange={(e) => setRouvrir(e.target.checked)} className="h-4 w-4 accent-emerald-700" /> Mon problème n’est pas réglé : rouvrir la conversation</label>
          )}
          <button onClick={valider} disabled={envoi} className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white disabled:opacity-50">{envoi ? "Envoi…" : "Envoyer mon avis"}</button>
        </>
      )}
      {err && <p className="text-center text-xs font-medium text-red-600">{err}</p>}
    </div>
  );
}
