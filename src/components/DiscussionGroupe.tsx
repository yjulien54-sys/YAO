"use client";

/**
 * Discussion du groupe : les membres s'écrivent dans l'application.
 * Chaque message prévient tout le groupe (notification). Mise à jour en temps réel.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, CheckSquare, ChevronDown, Copy, Lock, MessagesSquare, Reply, Send, Trash2, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { copier, useAppuiLong } from "@/lib/appuiLong";
import { BarreSelection, MenuActions, type Action } from "./MenuActions";

type Msg = { id: number; group_id: string; profile_id: string; auteur: string | null; texte: string; cree_le: string; destinataires?: string[] | null };
type Membre = { profileId: string; nom: string };

const heure = (iso: string) => {
  const d = new Date(iso), auj = new Date();
  const memeJour = d.toDateString() === auj.toDateString();
  return memeJour ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

/** Couleur stable par personne (initiales colorées) */
const COULEURS = ["bg-orange-100 text-orange-700", "bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-amber-100 text-amber-800", "bg-teal-100 text-teal-700"];
const couleur = (id: string) => COULEURS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % COULEURS.length];
const initiales = (n: string | null) => (n ?? "?").trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("");
const jour = (iso: string) => {
  const d = new Date(iso), auj = new Date(), hier = new Date(Date.now() - 86400000);
  if (d.toDateString() === auj.toDateString()) return "Aujourd’hui";
  if (d.toDateString() === hier.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
};

export function DiscussionGroupe({ groupId, userId, gestionnaire, membres = [] }: { groupId: string; userId: string | null; gestionnaire: boolean; membres?: Membre[] }) {
  const [msgs, setMsgs] = useState<Msg[] | null | "indispo">(null);
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const bas = useRef<HTMLDivElement>(null);
  const appuiLong = useAppuiLong();
  const [menu, setMenu] = useState<{ apercu: string; titre: string; actions: Action[] } | null>(null);
  const [selection, setSelection] = useState<number[] | null>(null);
  const [info, setInfo] = useState("");
  const flash = (t: string) => { setInfo(t); setTimeout(() => setInfo(""), 2000); };
  // À qui j'écris : null = tout le groupe ; sinon les personnes choisies (message privé)
  const [dest, setDest] = useState<string[] | null>(null);
  const [choixDest, setChoixDest] = useState<string[] | null>(null); // sélection en cours dans la fenêtre
  const [privesOk, setPrivesOk] = useState(true); // false tant que la mise à jour n°43 n'est pas faite
  const nomDe = (id: string) => membres.find((m) => m.profileId === id)?.nom.split(/\s+/)[0] ?? "un membre";
  const libelleDest = (ids: string[]) => ids.length <= 2 ? ids.map(nomDe).join(", ") : `${ids.slice(0, 2).map(nomDe).join(", ")} +${ids.length - 2}`;

  const charger = useCallback(async () => {
    const lire = (cols: string) => supabase.from("messages_groupe").select(cols).eq("group_id", groupId).order("cree_le", { ascending: false }).limit(150);
    let { data, error } = await lire("id, group_id, profile_id, auteur, texte, cree_le, destinataires");
    if (error && error.code !== "42P01" && error.code !== "PGRST205") {
      setPrivesOk(false); // mise à jour n°43 pas encore faite : pas de messages privés
      ({ data, error } = await lire("id, group_id, profile_id, auteur, texte, cree_le"));
    }
    if (error) return setMsgs(error.code === "42P01" || error.code === "PGRST205" ? "indispo" : []);
    setMsgs(((data as unknown as Msg[]) ?? []).reverse());
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
    const { error } = await supabase.from("messages_groupe").insert(dest ? { group_id: groupId, texte: t, destinataires: dest } : { group_id: groupId, texte: t });
    setEnvoi(false);
    if (error) return setErreur("Message non envoyé. Réessayez.");
    setTexte("");
    charger();
  }

  // Effacer : ses propres messages, ou tous si on est trésorier / co-gestionnaire
  const peutEffacer = (m: Msg) => m.profile_id === userId || gestionnaire;
  async function effacer(ids: number[]) {
    if (!ids.length || !confirm(ids.length > 1 ? `Effacer ces ${ids.length} messages pour tout le groupe ?` : "Effacer ce message pour tout le groupe ?")) return;
    setMsgs((l) => (Array.isArray(l) ? l.filter((m) => !ids.includes(m.id)) : l));
    setSelection(null);
    await supabase.from("messages_groupe").delete().in("id", ids);
    flash(ids.length > 1 ? "Messages effacés" : "Message effacé");
    charger();
  }

  if (msgs === "indispo") return <p className="carte p-4 text-sm text-amber-800">La discussion de groupe arrive bientôt (mise à jour n°39 à faire par l’administrateur Cotiz).</p>;

  return (
    <div className="carte overflow-hidden">
      {/* En-tête de la discussion */}
      <div className="relative flex items-center gap-3 overflow-hidden bg-gradient-to-r from-[#0b3d2c] to-[#0f6b47] px-4 py-3 text-white">
        <div className="motif absolute inset-0 opacity-10" />
        <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25"><MessagesSquare size={19} /></span>
        <div className="relative min-w-0 flex-1">
          <p className="font-bold leading-tight">Discussion du groupe</p>
          <p className="flex items-center gap-1 truncate text-[0.7rem] text-emerald-100"><BellRing size={11} className="shrink-0" /> Tout le groupe est prévenu</p>
        </div>
        {Array.isArray(msgs) && msgs.length > 0 && <span className="relative rounded-full bg-[#f5c400] px-2 py-0.5 text-[0.65rem] font-extrabold text-[#0b3d2c]">{msgs.length} 💬</span>}
      </div>
      {selection && (
        <div className="px-2 pt-2">
          <BarreSelection nombre={selection.length} total={Array.isArray(msgs) ? msgs.filter(peutEffacer).length : 0}
            toutSelectionner={() => setSelection(Array.isArray(msgs) ? msgs.filter(peutEffacer).map((m) => m.id) : [])}
            supprimer={() => effacer(selection)} annuler={() => setSelection(null)} />
        </div>
      )}
      <div className="max-h-[60vh] min-h-[240px] space-y-2 overflow-y-auto bg-[#f3f1ea] bg-[radial-gradient(rgba(11,61,44,0.06)_1px,transparent_1px)] p-3 [background-size:14px_14px]">
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
          const nouveauJour = i === 0 || jour(msgs[i - 1].cree_le) !== jour(m.cree_le);
          const memeAuteur = !nouveauJour && i > 0 && msgs[i - 1].profile_id === m.profile_id;
          return (
            <div key={m.id}>
              {nouveauJour && <p className="my-2 text-center"><span className="rounded-full bg-white/90 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-stone-500 shadow-sm ring-1 ring-stone-200/70">{jour(m.cree_le)}</span></p>}
            <div className={`apparait group flex items-end gap-2 ${moi ? "justify-end" : "justify-start"}`}>
              {!moi && <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[0.65rem] font-extrabold ${memeAuteur ? "invisible" : couleur(m.profile_id)}`}>{initiales(m.auteur)}</span>}
              {selection && peutEffacer(m) && (
                <span className={`order-first grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selection.includes(m.id) ? "border-emerald-700 bg-emerald-700 text-white" : "border-stone-300 bg-white"}`}>{selection.includes(m.id) && <span className="text-[0.6rem]">✓</span>}</span>
              )}
              <div onClick={selection && peutEffacer(m) ? () => setSelection((s) => (s ? (s.includes(m.id) ? s.filter((x) => x !== m.id) : [...s, m.id]) : s)) : undefined}
                {...(selection ? {} : appuiLong(() => setMenu({ titre: m.auteur ?? "Message", apercu: m.texte, actions: [
                  { label: "Copier", icone: Copy, onClick: () => copier(m.texte).then((ok) => flash(ok ? "Copié" : "Impossible de copier")) },
                  ...(!moi && privesOk && membres.some((x) => x.profileId === m.profile_id) ? [{ label: `Répondre en privé à ${(m.auteur ?? "ce membre").split(/\s+/)[0]}`, icone: Reply, onClick: () => setDest([m.profile_id]) }] : []),
                  ...(peutEffacer(m) ? [
                    { label: "Sélectionner", icone: CheckSquare, onClick: () => setSelection([m.id]) },
                    { label: "Effacer pour tout le groupe", icone: Trash2, danger: true, onClick: () => effacer([m.id]) },
                  ] : []),
                ] })))}
                className={`relative max-w-[78%] cursor-default rounded-2xl px-3 py-2 text-sm shadow-sm transition ${selection?.includes(m.id) ? "ring-4 ring-emerald-300" : ""} ${moi ? "rounded-br-md bg-gradient-to-br from-emerald-600 to-emerald-800 text-white" : "rounded-bl-md bg-white text-stone-800 ring-1 ring-stone-200/60"}`}>
                {!moi && !memeAuteur && <p className="text-[0.7rem] font-bold text-[#f77f00]">{m.auteur ?? "Membre"}</p>}
                {m.destinataires && m.destinataires.length > 0 && (
                  <p className={`mb-0.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${moi ? "bg-white/15 text-white" : "bg-violet-50 text-violet-700"}`}>
                    <Lock size={9} /> Privé · {moi ? `à ${libelleDest(m.destinataires)}` : m.destinataires.length > 1 ? `vous et ${m.destinataires.length - 1} autre${m.destinataires.length > 2 ? "s" : ""}` : "pour vous"}
                  </p>
                )}
                <p className="whitespace-pre-line break-words">{m.texte}</p>
                <p className={`mt-0.5 text-right text-[0.6rem] ${moi ? "text-white/70" : "text-stone-400"}`}>{heure(m.cree_le)}</p>
              </div>
            </div>
            </div>
          );
        })}
        <div ref={bas} />
      </div>
      {/* À qui j'écris */}
      {privesOk && membres.length > 0 && (
        <div className="flex items-center gap-2 border-t border-stone-100 bg-white px-3 pt-2">
          <span className="text-[0.7rem] font-bold uppercase tracking-wide text-stone-400">À</span>
          <button type="button" onClick={() => setChoixDest(dest ?? [])} className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${dest ? "bg-violet-100 text-violet-800 ring-1 ring-violet-200" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"}`}>
            {dest ? <Lock size={12} /> : <Users size={12} />}
            <span className="truncate">{dest ? `Privé · ${libelleDest(dest)}` : "Tout le groupe"}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>
          {dest && <button type="button" onClick={() => setDest(null)} aria-label="Revenir à tout le groupe" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-100 text-xs font-bold text-stone-500">✕</button>}
        </div>
      )}
      <form onSubmit={envoyer} className={`flex items-end gap-2 bg-white p-2.5 ${privesOk && membres.length > 0 ? "" : "border-t border-stone-100"}`}>
        <textarea value={texte} onChange={(e) => setTexte(e.target.value)} rows={1} maxLength={1000} placeholder={dest ? "Message privé…" : "Écrire au groupe…"}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.matchMedia("(min-width: 1024px)").matches) { e.preventDefault(); envoyer(e); } }}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[14px] border border-stone-300/80 bg-white px-3 py-2.5 text-base outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" />
        <button disabled={envoi || !texte.trim()} aria-label="Envoyer" className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#f77f00] to-[#e06a00] text-white shadow-[0_6px_16px_-6px_rgba(247,127,0,0.7)] transition active:scale-90 disabled:from-stone-300 disabled:to-stone-300 disabled:shadow-none"><Send size={18} /></button>
      </form>
      {erreur && <p className="px-3 pb-2 text-xs font-medium text-red-600">{erreur}</p>}
      {!selection && Array.isArray(msgs) && msgs.length > 0 && <p className="px-3 pb-2 text-[0.7rem] text-stone-400">Restez appuyé sur un message pour le copier ou l’effacer.</p>}
      {choixDest && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 backdrop-blur-[2px] lg:items-center" onClick={() => setChoixDest(null)}>
          <div className="feuille w-full max-w-md rounded-t-[28px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl lg:rounded-[28px]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-200" />
            <p className="px-1 font-bold">À qui voulez-vous écrire ?</p>
            <p className="px-1 text-xs text-stone-500">Un message privé n’est vu que par les personnes choisies.</p>
            <button type="button" onClick={() => { setDest(null); setChoixDest(null); }} className={`mt-3 flex w-full items-center gap-3 rounded-2xl p-3 text-left ring-1 ${choixDest.length === 0 ? "bg-emerald-50 ring-emerald-300" : "ring-stone-200"}`}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-white"><Users size={17} /></span>
              <span className="flex-1"><span className="block text-sm font-bold">Tout le groupe</span><span className="block text-xs text-stone-500">Tous les membres voient le message</span></span>
              {choixDest.length === 0 && <Check size={18} className="text-emerald-700" />}
            </button>
            <p className="mt-3 px-1 text-[0.7rem] font-bold uppercase tracking-wide text-stone-400">Ou choisir des membres</p>
            <div className="mt-1 max-h-[45vh] divide-y divide-stone-100 overflow-y-auto">
              {membres.map((m) => {
                const pris = choixDest.includes(m.profileId);
                return (
                  <button key={m.profileId} type="button" onClick={() => setChoixDest(pris ? choixDest.filter((x) => x !== m.profileId) : [...choixDest, m.profileId])} className="flex w-full items-center gap-3 px-1 py-2.5 text-left">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.65rem] font-extrabold ${couleur(m.profileId)}`}>{initiales(m.nom)}</span>
                    <span className="flex-1 truncate text-sm font-semibold">{m.nom}</span>
                    <span className={`grid h-6 w-6 place-items-center rounded-full border-2 ${pris ? "border-violet-600 bg-violet-600 text-white" : "border-stone-300"}`}>{pris && <Check size={13} strokeWidth={3} />}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" disabled={!choixDest.length} onClick={() => { setDest(choixDest); setChoixDest(null); }} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-700 py-3 text-sm font-bold text-white disabled:opacity-40">
              <Lock size={15} /> Écrire en privé{choixDest.length ? ` à ${choixDest.length} personne${choixDest.length > 1 ? "s" : ""}` : ""}
            </button>
          </div>
        </div>
      )}
      {menu && <MenuActions titre={menu.titre} apercu={menu.apercu} actions={menu.actions} fermer={() => setMenu(null)} />}
      {info && <div className="fixed inset-x-0 bottom-24 z-[80] flex justify-center"><span className="notif-entre rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-lg">{info}</span></div>}
    </div>
  );
}
