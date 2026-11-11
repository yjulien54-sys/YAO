"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, MessageSquareText, Send } from "lucide-react";
import { IconBadge } from "./icons";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { dateCourte } from "@/lib/format";

const MOTIFS = ["Un paiement", "Mon compte / mon code", "Un groupe", "Un versement", "Une arnaque / un problème grave", "Une suggestion", "Autre"];
type Requete = { id: string; numero: number; cree_le: string; motif: string; message: string; statut: "nouvelle" | "en_cours" | "resolue"; reponse: string | null };
const STATUT: Record<Requete["statut"], [string, string]> = {
  nouvelle: ["Envoyée", "bg-amber-50 text-amber-800"],
  en_cours: ["En cours", "bg-sky-50 text-sky-700"],
  resolue: ["Répondu", "bg-emerald-50 text-emerald-700"],
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

  const charger = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.from("requetes_clients").select("id, numero, cree_le, motif, message, statut, reponse").order("cree_le", { ascending: false }).limit(20);
    if (error) return setDispo(false); // mise à jour SQL n°18 pas encore faite
    setListe((data as Requete[]) ?? []);
  }, [userId]);
  useEffect(() => { charger(); }, [charger]);

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
          <p className="text-xs font-bold uppercase tracking-wide text-stone-500">Mes messages</p>
          {liste.map((r) => {
            const [l, c] = STATUT[r.statut];
            return (
              <div key={r.id} className="rounded-2xl bg-stone-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-semibold">{r.motif}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold ${c}`}>{l}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-stone-600">{r.message}</p>
                {r.reponse ? (
                  <p className="mt-2 rounded-xl bg-white p-2.5 text-stone-800 ring-1 ring-emerald-100"><b className="text-emerald-700">Service client :</b> {r.reponse}</p>
                ) : (
                  <p className="mt-1 flex items-center gap-1 text-xs text-stone-400"><Clock size={12} /> Envoyé le {dateCourte(r.cree_le)} · en attente de réponse</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
