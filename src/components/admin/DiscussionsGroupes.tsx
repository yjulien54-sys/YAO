"use client";

/**
 * Admin (fondateur uniquement) : lire les discussions des groupes, pour la surveillance.
 * Chaque ouverture d'une discussion et chaque message effacé sont inscrits dans le journal admin.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Eye, Lock, MessagesSquare, Search, ShieldAlert, Trash2 } from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

type Ligne = { group_id: string; nom: string; type: string; nb_messages: number; nb_prives: number; dernier_le: string; dernier_auteur: string | null; dernier_texte: string | null };
type Msg = { id: number; auteur: string | null; texte: string; cree_le: string; prive: boolean; destinataires: string | null };

const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const TYPE: Record<string, string> = { tontine: "Tontine", association: "Association", collecte: "Collecte" };

export function DiscussionsGroupes() {
  const [liste, setListe] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState("");
  const [cherche, setCherche] = useState("");
  const [ouverte, setOuverte] = useState<Ligne | null>(null);
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [msg, setMsg] = useState("");

  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_discussions");
    if (error) return setErreur(error.message.includes("fondateur") ? "Réservé au fondateur." : "Mise à jour SQL n°44 à faire dans Supabase.");
    setListe((data as Ligne[]) ?? []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const ouvrir = async (l: Ligne) => {
    setOuverte(l); setMsgs(null); setMsg("");
    const { data, error } = await db.rpc("admin_discussion", { g: l.group_id });
    if (error) return setMsg("Erreur : " + error.message);
    setMsgs(((data as Msg[]) ?? []).reverse());
  };
  const effacer = async (m: Msg) => {
    if (!ouverte || !confirm(`Effacer ce message de ${m.auteur ?? "ce membre"} pour tout le groupe ?\n\n« ${m.texte.slice(0, 120)} »`)) return;
    const { error } = await db.rpc("admin_message_effacer", { mid: m.id });
    if (error) return setMsg("Erreur : " + error.message);
    setMsg("Message effacé (inscrit dans le journal admin).");
    ouvrir(ouverte);
  };

  const visibles = useMemo(() => (liste ?? []).filter((l) => !cherche.trim() || `${l.nom} ${l.dernier_auteur ?? ""}`.toLowerCase().includes(cherche.trim().toLowerCase())), [liste, cherche]);

  if (erreur) return <p className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">{erreur}</p>;

  if (ouverte) {
    return (
      <div className="space-y-3">
        <button onClick={() => { setOuverte(null); charger(); }} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-stone-700 shadow-sm ring-1 ring-stone-200"><ArrowLeft size={15} /> Toutes les discussions</button>
        <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
          <div className="flex items-center gap-3 bg-gradient-to-r from-[#0b3d2c] to-[#0f6b47] px-4 py-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/15"><MessagesSquare size={19} /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{ouverte.nom}</p>
              <p className="text-[0.7rem] text-emerald-100">{TYPE[ouverte.type] ?? ouverte.type} · {ouverte.nb_messages} message{ouverte.nb_messages > 1 ? "s" : ""}{ouverte.nb_prives ? ` · ${ouverte.nb_prives} privé${ouverte.nb_prives > 1 ? "s" : ""}` : ""}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[0.65rem] font-bold"><Eye size={11} /> Lecture admin</span>
          </div>
          <p className="flex items-center gap-1.5 bg-amber-50 px-4 py-2 text-[0.7rem] text-amber-900"><ShieldAlert size={13} /> Votre consultation est inscrite dans le journal admin. Les membres ne voient pas que vous lisez.</p>
          <div className="max-h-[65vh] space-y-2 overflow-y-auto bg-[#f3f1ea] p-3">
            {msgs === null && <p className="py-8 text-center text-sm text-stone-400">Chargement…</p>}
            {msgs?.length === 0 && <p className="py-8 text-center text-sm text-stone-400">Aucun message.</p>}
            {msgs?.map((m) => (
              <div key={m.id} className={`group max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${m.prive ? "bg-violet-50 ring-1 ring-violet-200" : "bg-white ring-1 ring-stone-200/70"}`}>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[0.7rem] font-bold text-[#f77f00]">{m.auteur ?? "Membre"}</p>
                  <button onClick={() => effacer(m)} title="Effacer ce message" className="grid h-6 w-6 place-items-center rounded-full text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
                {m.prive && <p className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-violet-800"><Lock size={9} /> Privé · à {m.destinataires}</p>}
                <p className="whitespace-pre-line break-words text-stone-800">{m.texte}</p>
                <p className="mt-0.5 text-right text-[0.6rem] text-stone-400">{quand(m.cree_le)}</p>
              </div>
            ))}
          </div>
        </div>
        {msg && <p className={`text-sm font-medium ${msg.startsWith("Erreur") ? "text-red-600" : "text-emerald-700"}`}>{msg}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-stone-200">
        <Search size={16} className="text-stone-400" />
        <input value={cherche} onChange={(e) => setCherche(e.target.value)} placeholder="Chercher un groupe ou un membre…" className="flex-1 bg-transparent py-1 text-sm outline-none" />
      </div>
      <p className="flex items-center gap-1.5 px-1 text-xs text-stone-500"><ShieldAlert size={13} className="text-amber-600" /> Réservé au fondateur. Chaque discussion ouverte est inscrite dans le journal admin.</p>
      {liste === null && <p className="py-8 text-center text-sm text-stone-400">Chargement…</p>}
      {liste?.length === 0 && <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500 ring-1 ring-stone-200">Aucune discussion pour l’instant.</p>}
      <div className="divide-y divide-stone-100 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200">
        {visibles.map((l) => (
          <button key={l.group_id} onClick={() => ouvrir(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-stone-50">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white"><MessagesSquare size={19} /></span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-bold text-stone-900">{l.nom}</span>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[0.65rem] font-bold text-stone-600">{TYPE[l.type] ?? l.type}</span>
              </span>
              <span className="block truncate text-[0.8125rem] text-stone-500"><b className="font-semibold text-stone-700">{l.dernier_auteur ?? "Membre"} :</b> {l.dernier_texte}</span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[0.7rem] text-stone-400">{quand(l.dernier_le)}</span>
              <span className="mt-1 inline-flex items-center gap-1">
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.65rem] font-bold text-emerald-800">{l.nb_messages}</span>
                {l.nb_prives > 0 && <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[0.65rem] font-bold text-violet-800"><Lock size={9} />{l.nb_prives}</span>}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
