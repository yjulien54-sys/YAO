"use client";

/**
 * Discussion du groupe : les membres s'écrivent dans l'application.
 * Chaque message prévient tout le groupe (notification). Mise à jour en temps réel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Msg = { id: number; group_id: string; profile_id: string; auteur: string | null; texte: string; cree_le: string };

const heure = (iso: string) => {
  const d = new Date(iso), auj = new Date();
  const memeJour = d.toDateString() === auj.toDateString();
  return memeJour ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export function DiscussionGroupe({ groupId, userId, gestionnaire }: { groupId: string; userId: string | null; gestionnaire: boolean }) {
  const [msgs, setMsgs] = useState<Msg[] | null | "indispo">(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const bas = useRef<HTMLDivElement>(null);

  const charger = useCallback(async () => {
    const { data, error } = await supabase.from("messages_groupe").select("id, group_id, profile_id, auteur, texte, cree_le").eq("group_id", groupId).order("cree_le", { ascending: false }).limit(150);
    if (error) return setMsgs(error.code === "42P01" || error.code === "PGRST205" ? "indispo" : []);
    setMsgs(((data as Msg[]) ?? []).reverse());
  }, [groupId]);

  useEffect(() => {
    charger();
    const canal = supabase.channel(`discussion-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages_groupe", filter: `group_id=eq.${groupId}` }, () => charger())
      .subscribe();
    const t = setInterval(charger, 30_000); // secours si le temps réel ne passe pas
    return () => { supabase.removeChannel(canal); clearInterval(t); };
  }, [groupId, charger]);

  useEffect(() => { bas.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setEnvoi(true); setErreur("");
    const { error } = await supabase.from("messages_groupe").insert({ group_id: groupId, texte: t });
    setEnvoi(false);
    if (error) return setErreur("Message non envoyé. Réessayez.");
    setTexte("");
    charger();
  }

  async function effacer(id: number) {
    if (!confirm("Effacer ce message pour tout le groupe ?")) return;
    await supabase.from("messages_groupe").delete().eq("id", id);
    charger();
  }

  if (msgs === "indispo") return <p className="carte p-4 text-sm text-amber-800">La discussion de groupe arrive bientôt (mise à jour n°39 à faire par l’administrateur Cotiz).</p>;

  return (
    <div className="carte overflow-hidden">
      <div className="max-h-[60vh] min-h-[240px] space-y-2 overflow-y-auto bg-[#f3f1ea] p-3">
        {msgs === null && <p className="py-10 text-center text-sm text-stone-400">Chargement…</p>}
        {msgs !== null && msgs.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-3xl">💬</p>
            <p className="mt-2 text-sm font-semibold text-stone-700">Aucun message pour l’instant</p>
            <p className="text-xs text-stone-500">Écrivez au groupe : tous les membres seront prévenus.</p>
          </div>
        )}
        {msgs !== null && msgs.map((m, i) => {
          const moi = m.profile_id === userId;
          const memeAuteur = i > 0 && msgs[i - 1].profile_id === m.profile_id;
          return (
            <div key={m.id} className={`group flex ${moi ? "justify-end" : "justify-start"}`}>
              <div className={`relative max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm ${moi ? "rounded-br-md bg-emerald-700 text-white" : "rounded-bl-md bg-white text-stone-800"}`}>
                {!moi && !memeAuteur && <p className="text-[0.7rem] font-bold text-[#f77f00]">{m.auteur ?? "Membre"}</p>}
                <p className="whitespace-pre-line break-words">{m.texte}</p>
                <p className={`mt-0.5 text-right text-[0.6rem] ${moi ? "text-white/70" : "text-stone-400"}`}>{heure(m.cree_le)}</p>
                {(moi || gestionnaire) && (
                  <button type="button" onClick={() => effacer(m.id)} aria-label="Effacer le message" className={`absolute -top-2 ${moi ? "-left-2" : "-right-2"} hidden h-6 w-6 place-items-center rounded-full bg-white text-stone-500 shadow ring-1 ring-stone-200 group-hover:grid`}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bas} />
      </div>
      <form onSubmit={envoyer} className="flex items-end gap-2 border-t border-stone-100 bg-white p-2.5">
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} maxLength={1000} placeholder="Écrire au groupe…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 1024px)").matches) { e.preventDefault(); envoyer(e); } }}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[14px] border border-stone-300/80 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
        <button disabled={envoi || !texte.trim()} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-700 text-white disabled:opacity-40"><Send size={18} /></button>
      </form>
      {erreur && <p className="px-3 pb-2 text-xs font-medium text-red-600">{erreur}</p>}
      <p className="px-3 pb-2.5 text-[0.7rem] text-stone-400">Chaque message envoie une notification à tous les membres du groupe.</p>
    </div>
  );
}
