"use client";

/**
 * Planning de l'équipe Cotiz : grille personnes × jours, créneaux en couleur qu'on glisse
 * d'un jour ou d'une personne à l'autre, durée de 7 h par défaut (la fin se calcule seule),
 * échange de créneaux, remplissage automatique d'une semaine, et lien d'agenda pour le téléphone.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Moon, Plus, Repeat2, Smartphone, Sparkles, Sun, Sunrise, Sunset, Trash2, Wand2, X } from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

type Agent = { email: string; nom: string | null; numero: number | null; role: string; telephone: string | null };
type Creneau = { id: string; email: string; nom: string | null; numero: number | null; fonctions?: string[]; jour: string; debut: string; fin: string; note: string | null };

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lundiDe = (d: Date) => { const x = new Date(d); x.setHours(12, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
const duree = (c: { debut: string; fin: string }) => { const d = minutes(c.fin) - minutes(c.debut); return (d <= 0 ? d + 1440 : d) / 60; };
const h = (t: string) => t.slice(0, 5).replace(":", "h");
const champ = "w-full rounded-xl border border-stone-300/80 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

/** Le moment de la journée donne la couleur du créneau */
const MOMENTS = [
  { id: "matin", label: "Matin", debut: "08:00", ico: Sunrise, cl: "from-amber-400 to-orange-500", pale: "bg-amber-50 text-amber-900 ring-amber-200" },
  { id: "journee", label: "Journée", debut: "11:00", ico: Sun, cl: "from-emerald-500 to-emerald-700", pale: "bg-emerald-50 text-emerald-900 ring-emerald-200" },
  { id: "soir", label: "Soir", debut: "15:00", ico: Sunset, cl: "from-indigo-500 to-violet-600", pale: "bg-indigo-50 text-indigo-900 ring-indigo-200" },
  { id: "nuit", label: "Nuit", debut: "22:00", ico: Moon, cl: "from-slate-700 to-slate-900", pale: "bg-slate-100 text-slate-900 ring-slate-300" },
] as const;
const momentDe = (debut: string) => { const m = minutes(debut); return m < 600 && m >= 300 ? MOMENTS[0] : m < 840 && m >= 300 ? MOMENTS[1] : m < 1200 && m >= 300 ? MOMENTS[2] : MOMENTS[3]; };
const COULEURS = ["#009e60", "#f77f00", "#2c7fb8", "#7c3aed", "#db2777", "#0d9488", "#b45309", "#4f46e5"];

export function PlanningPro({ fondateur, equipe, moi }: { fondateur: boolean; equipe: Agent[]; moi: string }) {
  const [lundi, setLundi] = useState(() => lundiDe(new Date()));
  const [liste, setListe] = useState<Creneau[] | null>(null);
  const [msg, setMsg] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [edition, setEdition] = useState<{ c?: Creneau; email: string; jour: string } | null>(null);
  const [auto, setAuto] = useState(false);
  const [survol, setSurvol] = useState<string | null>(null);
  const [glisse, setGlisse] = useState<string | null>(null);
  const jours = useMemo(() => Array.from({ length: 7 }, (_, k) => { const d = new Date(lundi); d.setDate(d.getDate() + k); return d; }), [lundi]);

  const charger = useCallback(async () => {
    const { data, error } = await db.rpc("admin_planning", { du: iso(jours[0]), au: iso(jours[6]) });
    setListe(error ? null : ((data as Creneau[]) ?? []));
  }, [jours]);
  useEffect(() => { charger(); }, [charger]);

  const decaler = (n: number) => { const d = new Date(lundi); d.setDate(d.getDate() + 7 * n); setLundi(d); };
  const agents = useMemo(() => {
    const l = equipe.filter((a) => a.role === "agent" || (liste ?? []).some((c) => c.email.toLowerCase() === a.email.toLowerCase()));
    return l.sort((a, b) => (a.numero ?? 9999) - (b.numero ?? 9999));
  }, [equipe, liste]);
  const couleur = (email: string) => COULEURS[Math.max(0, agents.findIndex((a) => a.email.toLowerCase() === email.toLowerCase())) % COULEURS.length];
  const nom = (a: { nom: string | null; email: string }) => a.nom ?? a.email.split("@")[0];
  const estMoi = (email: string) => email.toLowerCase() === moi.toLowerCase();

  const executer = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setOccupe(true); setMsg("");
    const { error } = await fn();
    setOccupe(false);
    if (error) { setMsg("Erreur : " + (error.message.includes("admin_planning_modifier") || error.message.includes("admin_planning_echanger") || error.message.includes("admin_planning_generer") ? "fais d’abord la mise à jour SQL n°36 dans Supabase" : error.message)); return false; }
    setMsg(ok); charger(); return true;
  };
  const deplacer = (c: Creneau, email: string, jour: string) => {
    if (c.email.toLowerCase() === email.toLowerCase() && c.jour === jour) return;
    executer(() => db.rpc("admin_planning_modifier", { i: c.id, adresse: email, j: jour, de: c.debut.slice(0, 5), a: c.fin.slice(0, 5), remarque: c.note }), `Créneau déplacé vers ${nom(agents.find((a) => a.email.toLowerCase() === email.toLowerCase()) ?? { nom: null, email })}, ${new Date(jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric" })}.`);
  };
  const echanger = (a: Creneau, b: Creneau) => {
    if (a.id === b.id) return;
    if (!confirm(`Échanger les créneaux de ${nom(a)} (${h(a.debut)}) et ${nom(b)} (${h(b.debut)}) ?`)) return;
    executer(() => db.rpc("admin_planning_echanger", { i1: a.id, i2: b.id }), "Créneaux échangés.");
  };
  const copierSemainePrecedente = async () => {
    const avant = new Date(jours[0]); avant.setDate(avant.getDate() - 7);
    const fin = new Date(jours[6]); fin.setDate(fin.getDate() - 7);
    const { data, error } = await db.rpc("admin_planning", { du: iso(avant), au: iso(fin) });
    if (error) return setMsg("Erreur : " + error.message);
    const anciens = (data as Creneau[]) ?? [];
    if (!anciens.length) return setMsg("La semaine précédente est vide : rien à copier.");
    if (!confirm(`Remplacer cette semaine par les ${anciens.length} créneaux de la semaine précédente ?`)) return;
    const lignes = anciens.map((c) => { const d = new Date(c.jour + "T12:00"); d.setDate(d.getDate() + 7); return { email: c.email, jour: iso(d), debut: c.debut.slice(0, 5), fin: c.fin.slice(0, 5), note: c.note }; });
    executer(() => db.rpc("admin_planning_generer", { du: iso(jours[0]), au: iso(jours[6]), lignes, remplacer: true }), "Semaine précédente copiée.");
  };
  const viderSemaine = async () => {
    if (!liste?.length || !confirm(`Supprimer les ${liste.length} créneaux de cette semaine ?`)) return;
    setOccupe(true);
    for (const c of liste) await db.rpc("admin_planning_supprimer", { i: c.id });
    setOccupe(false); setMsg("Semaine vidée."); charger();
  };

  if (liste === null) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Pour le planning, fais d’abord la <b>mise à jour SQL n°18</b> dans Supabase.</p>;
  const aujourdhui = iso(new Date());
  const total = liste.reduce((t, c) => t + duree(c), 0);
  const couverture = jours.map((d) => {
    const l = liste.filter((c) => c.jour === iso(d));
    return { matin: l.some((c) => minutes(c.debut) < 720), soir: l.some((c) => minutes(c.fin) > 1020 || minutes(c.fin) <= minutes(c.debut)) };
  });
  const joursCouverts = couverture.filter((x) => x.matin && x.soir).length;

  return (
    <>
      {/* ---- En-tête ---- */}
      <div className="degrade-vert relative overflow-hidden rounded-3xl p-5 text-white shadow-lg">
        <div className="motif pointer-events-none absolute inset-0 opacity-25" />
        <div className="balaie pointer-events-none absolute inset-y-0 left-0" />
        <div className="relative flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo.svg" alt="Cotiz" width={52} height={52} className="h-14 w-14 rounded-2xl shadow-lg ring-2 ring-white/30" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-100">Planning de l’équipe</p>
            <p className="text-2xl font-extrabold">Semaine du {jours[0].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })} au {jours[6].toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => decaler(-1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Semaine précédente"><ChevronLeft size={20} /></button>
            <button onClick={() => setLundi(lundiDe(new Date()))} className="rounded-full bg-white px-4 py-2 text-sm font-bold text-emerald-800">Cette semaine</button>
            <button onClick={() => decaler(1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 hover:bg-white/25" aria-label="Semaine suivante"><ChevronRight size={20} /></button>
          </div>
        </div>
        <div className="relative mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15"><p className="text-2xl font-extrabold tabular-nums">{Math.round(total)} h</p><p className="text-[0.7rem] text-emerald-50">de travail prévues</p></div>
          <div className="rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15"><p className="text-2xl font-extrabold tabular-nums">{new Set(liste.map((c) => c.email)).size}</p><p className="text-[0.7rem] text-emerald-50">personnes au planning</p></div>
          <div className="rounded-2xl bg-white/10 p-2.5 ring-1 ring-white/15"><p className="text-2xl font-extrabold tabular-nums">{joursCouverts}/7</p><p className="text-[0.7rem] text-emerald-50">jours couverts matin + soir</p></div>
        </div>
        <div className="bande-kente pointer-events-none absolute inset-x-0 bottom-0" />
      </div>

      {/* ---- Outils ---- */}
      {fondateur && (
        <div className="flex flex-wrap gap-2">
          <button disabled={occupe || !agents.length} onClick={() => setAuto(true)} className="carte-vivante inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-md disabled:opacity-50"><Wand2 size={16} /> Remplir automatiquement</button>
          <button disabled={occupe} onClick={copierSemainePrecedente} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800 disabled:opacity-50"><Copy size={15} /> Copier la semaine précédente</button>
          {liste.length > 0 && <button disabled={occupe} onClick={viderSemaine} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50"><Trash2 size={15} /> Vider la semaine</button>}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600">
        {MOMENTS.map((m) => <span key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-stone-200"><span className={`h-3 w-3 rounded-full bg-gradient-to-br ${m.cl}`} /> {m.label}</span>)}
        {fondateur && <span className="text-stone-500">· Glisse un créneau vers un autre jour ou une autre personne · Lâche-le sur un autre créneau pour échanger · Touche une case vide pour ajouter</span>}
      </div>
      {msg && <p className={`rounded-xl p-3 text-sm font-medium ${msg.startsWith("Erreur") ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-800"}`}>{msg}</p>}

      {/* ---- Grille personnes × jours ---- */}
      <div className="overflow-x-auto rounded-3xl border border-stone-200/80 bg-white shadow-sm" data-pas-glisser>
        <table className="w-full min-w-[920px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-48 bg-white p-3 text-left text-xs font-bold uppercase tracking-wide text-stone-500">Équipe</th>
              {jours.map((d, k) => {
                const auj = iso(d) === aujourdhui;
                const cv = couverture[k];
                return (
                  <th key={k} className={`p-2 text-center ${auj ? "bg-emerald-50" : ""}`}>
                    <p className={`text-xs font-bold uppercase ${auj ? "text-emerald-700" : "text-stone-500"}`}>{JOURS[k]}</p>
                    <p className={`mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-base font-extrabold ${auj ? "bg-emerald-600 text-white shadow" : "text-stone-800"}`}>{d.getDate()}</p>
                    <p className="mt-1 flex justify-center gap-1" title="Couverture matin / soir">
                      <span className={`h-1.5 w-5 rounded-full ${cv.matin ? "bg-amber-400" : "bg-stone-200"}`} />
                      <span className={`h-1.5 w-5 rounded-full ${cv.soir ? "bg-indigo-500" : "bg-stone-200"}`} />
                    </p>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {agents.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-stone-500">Ajoute d’abord un agent dans l’onglet Équipe.</td></tr>}
            {agents.map((a) => {
              const siens = liste.filter((c) => c.email.toLowerCase() === a.email.toLowerCase());
              const heures = siens.reduce((t, c) => t + duree(c), 0);
              const col = couleur(a.email);
              return (
                <tr key={a.email} className="group">
                  <td className="sticky left-0 z-10 border-t border-stone-100 bg-white p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-extrabold text-white shadow-sm" style={{ background: `linear-gradient(135deg, ${col}, ${col}cc)` }}>{nom(a).split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="truncate font-bold">{estMoi(a.email) ? "Toi" : nom(a)}</p>
                        <p className="text-[0.7rem] text-stone-500">{a.numero ? `n°${a.numero} · ` : ""}{Math.round(heures * 10) / 10} h / 35 h</p>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-stone-100"><div className="etire h-full rounded-full" style={{ width: `${Math.min(100, (heures / 35) * 100)}%`, background: heures > 40 ? "#dc2626" : col }} /></div>
                      </div>
                    </div>
                  </td>
                  {jours.map((d, k) => {
                    const j = iso(d);
                    const cle = `${a.email}|${j}`;
                    const ici = siens.filter((c) => c.jour === j).sort((x, y) => x.debut.localeCompare(y.debut));
                    return (
                      <td key={k}
                        onDragOver={(e) => { if (fondateur && glisse) { e.preventDefault(); setSurvol(cle); } }}
                        onDragLeave={() => setSurvol((s) => (s === cle ? null : s))}
                        onDrop={(e) => { e.preventDefault(); setSurvol(null); const c = liste.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (c) deplacer(c, a.email, j); setGlisse(null); }}
                        className={`h-24 border-l border-t border-stone-100 p-1.5 align-top transition-colors ${iso(d) === aujourdhui ? "bg-emerald-50/50" : ""} ${survol === cle ? "bg-orange-50 ring-2 ring-inset ring-orange-300" : ""}`}>
                        <div className="flex h-full flex-col gap-1">
                          {ici.map((c) => {
                            const m = momentDe(c.debut);
                            const Ico = m.ico;
                            const nuit = minutes(c.fin) <= minutes(c.debut);
                            return (
                              <button key={c.id} type="button" draggable={fondateur}
                                onDragStart={(e) => { e.dataTransfer.setData("text/plain", c.id); e.dataTransfer.effectAllowed = "move"; setGlisse(c.id); }}
                                onDragEnd={() => { setGlisse(null); setSurvol(null); }}
                                onDragOver={(e) => { if (fondateur && glisse && glisse !== c.id) { e.preventDefault(); e.stopPropagation(); } }}
                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setSurvol(null); const autre = liste.find((x) => x.id === e.dataTransfer.getData("text/plain")); if (autre) echanger(autre, c); setGlisse(null); }}
                                onClick={() => fondateur && setEdition({ c, email: c.email, jour: c.jour })}
                                className={`apparait w-full rounded-xl bg-gradient-to-br ${m.cl} px-2 py-1.5 text-left text-white shadow-sm transition ${fondateur ? "cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing" : "cursor-default"} ${glisse === c.id ? "opacity-40" : ""} ${estMoi(c.email) ? "ring-2 ring-offset-1 ring-emerald-300" : ""}`}>
                                <span className="flex items-center gap-1 text-[0.72rem] font-extrabold"><Ico size={12} /> {h(c.debut)} → {h(c.fin)}{nuit && <sup className="text-[0.55rem]">+1</sup>}</span>
                                <span className="block truncate text-[0.65rem] text-white/85">{Math.round(duree(c) * 10) / 10} h{c.note ? ` · ${c.note}` : ""}</span>
                              </button>
                            );
                          })}
                          {fondateur && (
                            <button type="button" onClick={() => setEdition({ email: a.email, jour: j })} className={`grid flex-1 place-items-center rounded-xl border border-dashed border-stone-200 text-stone-300 opacity-0 transition hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-600 group-hover:opacity-100 focus:opacity-100 ${ici.length === 0 ? "min-h-[3rem] opacity-60" : "min-h-[1.5rem]"}`} aria-label={`Ajouter un créneau pour ${nom(a)} le ${JOURS[k]} ${d.getDate()}`}>
                              <Plus size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AgendaTelephone fondateur={fondateur} agents={agents} moi={moi} />

      {edition && <EditeurCreneau init={edition} agents={agents} liste={liste} fermer={() => setEdition(null)} executer={executer} />}
      {auto && <RemplissageAuto agents={agents} jours={jours} fermer={() => setAuto(false)} executer={executer} />}
    </>
  );
}

/** Fenêtre de modification d'un créneau : moment, début, durée (7 h par défaut), fin calculée */
function EditeurCreneau({ init, agents, liste, fermer, executer }: { init: { c?: Creneau; email: string; jour: string }; agents: Agent[]; liste: Creneau[]; fermer: () => void; executer: (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => Promise<boolean> }) {
  const c = init.c;
  const [email, setEmail] = useState(init.email);
  const [jour, setJour] = useState(init.jour);
  const [debut, setDebut] = useState(c ? c.debut.slice(0, 5) : "08:00");
  const [heures, setHeures] = useState(c ? duree(c) : 7);
  const [note, setNote] = useState(c?.note ?? "");
  const [avec, setAvec] = useState("");
  const fin = hhmm(minutes(debut) + Math.round(heures * 60));
  const nuit = minutes(fin) <= minutes(debut);
  const m = momentDe(debut);
  const memeJour = liste.filter((x) => x.jour === jour && x.id !== c?.id);
  const nomDe = (e: string) => { const a = agents.find((x) => x.email.toLowerCase() === e.toLowerCase()); return a?.nom ?? e.split("@")[0]; };
  const enregistrer = async () => {
    const ok = c
      ? await executer(() => db.rpc("admin_planning_modifier", { i: c.id, adresse: email, j: jour, de: debut, a: fin, remarque: note || null }), "Créneau modifié.")
      : await executer(() => db.rpc("admin_planning_ajouter", { adresse: email, j: jour, de: debut, a: fin, remarque: note || null }), "Créneau ajouté.");
    if (ok) fermer();
  };
  const toute_la_semaine = async () => {
    const l = lundiDe(new Date(jour + "T12:00"));
    const lignes = Array.from({ length: 5 }, (_, k) => { const d = new Date(l); d.setDate(d.getDate() + k); return { email, jour: iso(d), debut, fin, note }; })
      .filter((x) => !liste.some((y) => y.email.toLowerCase() === email.toLowerCase() && y.jour === x.jour && y.id !== c?.id));
    const fin_ = new Date(l); fin_.setDate(fin_.getDate() + 6);
    if (await executer(() => db.rpc("admin_planning_generer", { du: iso(l), au: iso(fin_), lignes, remplacer: false }), `Même horaire ajouté du lundi au vendredi (${lignes.length} jour${lignes.length > 1 ? "s" : ""}).`)) fermer();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 p-0 sm:items-center sm:p-4" onClick={fermer}>
      <div className="feuille-droite max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className={`relative overflow-hidden bg-gradient-to-br ${m.cl} p-5 text-white`}>
          <button onClick={fermer} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/20" aria-label="Fermer"><X size={18} /></button>
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">{c ? "Modifier le créneau" : "Nouveau créneau"}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">{h(debut)} → {h(fin)}{nuit && <sup className="ml-1 text-sm">lendemain</sup>}</p>
          <p className="text-sm text-white/90">{nomDe(email)} · {new Date(jour + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} · {Math.round(heures * 10) / 10} h de travail</p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-stone-600">Personne<select value={email} onChange={(e) => setEmail(e.target.value)} className={champ}>{agents.map((a) => <option key={a.email} value={a.email}>{a.numero ? `${a.numero} · ` : ""}{a.nom ?? a.email}</option>)}</select></label>
            <label className="text-xs font-semibold text-stone-600">Jour<input type="date" value={jour} onChange={(e) => setJour(e.target.value)} className={champ} /></label>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone-600">Moment de la journée</p>
            <div className="grid grid-cols-4 gap-1.5">
              {MOMENTS.map((x) => { const Ico = x.ico; return (
                <button key={x.id} type="button" onClick={() => setDebut(x.debut)} className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-xs font-bold ring-1 transition ${m.id === x.id ? `bg-gradient-to-br ${x.cl} text-white ring-transparent shadow` : x.pale}`}>
                  <Ico size={18} /> {x.label}<span className="text-[0.65rem] font-normal opacity-80">{h(x.debut)}</span>
                </button>
              ); })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-stone-600">Début<input type="time" value={debut} onChange={(e) => setDebut(e.target.value || "08:00")} className={champ} /></label>
            <label className="text-xs font-semibold text-stone-600">Fin (calculée)<input value={`${fin}${nuit ? " (lendemain)" : ""}`} readOnly className={`${champ} bg-stone-50 font-bold`} /></label>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-stone-600">Durée de travail</p>
            <div className="flex flex-wrap gap-1.5">
              {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <button key={n} type="button" onClick={() => setHeures(n)} className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 ${heures === n ? "bg-emerald-700 text-white ring-transparent" : "bg-white text-stone-700 ring-stone-200"}`}>{n} h</button>)}
              <input type="number" min={0.5} max={16} step={0.5} value={heures} onChange={(e) => setHeures(Math.min(16, Math.max(0.5, Number(e.target.value) || 7)))} className="w-20 rounded-full border border-stone-200 px-3 py-1.5 text-sm" aria-label="Autre durée" />
            </div>
          </div>
          <label className="block text-xs font-semibold text-stone-600">Note (facultatif)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ex : Accueil téléphone, Relances…" className={champ} /></label>
          {c && memeJour.length > 0 && (
            <div className="flex gap-2 rounded-2xl bg-violet-50 p-3">
              <select value={avec} onChange={(e) => setAvec(e.target.value)} className={`${champ} flex-1`}>
                <option value="">Échanger avec…</option>
                {memeJour.map((x) => <option key={x.id} value={x.id}>{nomDe(x.email)} · {h(x.debut)} → {h(x.fin)}</option>)}
              </select>
              <button disabled={!avec} onClick={async () => { if (await executer(() => db.rpc("admin_planning_echanger", { i1: c.id, i2: avec }), "Créneaux échangés.")) fermer(); }} className="inline-flex items-center gap-1 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white disabled:opacity-40"><Repeat2 size={15} /> Échanger</button>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={enregistrer} className="flex-1 rounded-xl bg-emerald-700 py-3 text-sm font-extrabold text-white shadow">{c ? "Enregistrer" : "Ajouter au planning"}</button>
            <button onClick={toute_la_semaine} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-bold text-emerald-800" title="Ajoute le même horaire du lundi au vendredi">Lun → Ven</button>
            {c && <button onClick={async () => { if (confirm("Supprimer ce créneau ?") && await executer(() => db.rpc("admin_planning_supprimer", { i: c.id }), "Créneau supprimé.")) fermer(); }} className="grid w-12 place-items-center rounded-xl border border-red-200 text-red-600" aria-label="Supprimer"><Trash2 size={17} /></button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Remplissage automatique : choisir les personnes, les jours et les horaires → semaine prête en un clic */
function RemplissageAuto({ agents, jours, fermer, executer }: { agents: Agent[]; jours: Date[]; fermer: () => void; executer: (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => Promise<boolean> }) {
  const [qui, setQui] = useState<string[]>(agents.filter((a) => a.role === "agent").slice(0, 3).map((a) => a.email));
  const [joursOk, setJoursOk] = useState([true, true, true, true, true, true, false]);
  const [postes, setPostes] = useState([{ debut: "08:00", heures: 7 }, { debut: "15:00", heures: 7 }]);
  const [decalage, setDecalage] = useState(0);
  const nomDe = (e: string) => agents.find((x) => x.email === e)?.nom ?? e.split("@")[0];
  // Rotation : chaque jour, on décale d'un cran → matin et soir tournent, et le repos aussi quand il y a plus de personnes que de postes
  const plan = useMemo(() => {
    const l: { email: string; jour: string; debut: string; fin: string; note: string }[] = [];
    if (!qui.length) return l;
    let n = 0;
    jours.forEach((d, k) => {
      if (!joursOk[k]) return;
      postes.forEach((p, s) => {
        if (s >= qui.length) return;
        const email = qui[(n + s + decalage) % qui.length];
        l.push({ email, jour: iso(d), debut: p.debut, fin: hhmm(minutes(p.debut) + Math.round(p.heures * 60)), note: momentDe(p.debut).label });
      });
      n++;
    });
    return l;
  }, [qui, joursOk, postes, decalage, jours]);
  const appliquer = async () => {
    if (!plan.length) return;
    if (await executer(() => db.rpc("admin_planning_generer", { du: iso(jours[0]), au: iso(jours[6]), lignes: plan, remplacer: true }), `Semaine remplie : ${plan.length} créneaux.`)) fermer();
  };
  const heuresDe = (e: string) => plan.filter((x) => x.email === e).reduce((t, x) => t + duree(x), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/50 sm:items-center sm:p-4" onClick={fermer}>
      <div className="feuille-droite max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 via-amber-500 to-emerald-600 p-5 text-white">
          <div className="balaie pointer-events-none absolute inset-y-0 left-0" />
          <button onClick={fermer} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/20" aria-label="Fermer"><X size={18} /></button>
          <p className="flex items-center gap-2 text-2xl font-extrabold"><Sparkles size={22} /> Remplir la semaine automatiquement</p>
          <p className="text-sm text-white/90">Choisis les personnes et les horaires : Cotiz fait tourner le matin, le soir et les repos.</p>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-sm font-bold">1. Qui travaille ?</p>
            <div className="flex flex-wrap gap-2">
              {agents.map((a, k) => { const on = qui.includes(a.email); return (
                <button key={a.email} onClick={() => setQui(on ? qui.filter((x) => x !== a.email) : [...qui, a.email])} className={`inline-flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-bold ring-1 transition ${on ? "bg-emerald-700 text-white ring-transparent shadow" : "bg-white text-stone-600 ring-stone-200"}`}>
                  <span className="grid h-7 w-7 place-items-center rounded-full text-xs text-white" style={{ background: COULEURS[k % COULEURS.length] }}>{(a.nom ?? a.email)[0].toUpperCase()}</span>{a.nom ?? a.email}
                </button>
              ); })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold">2. Quels jours ?</p>
            <div className="flex flex-wrap gap-1.5">{JOURS.map((j, k) => <button key={j} onClick={() => setJoursOk(joursOk.map((v, i) => (i === k ? !v : v)))} className={`h-10 w-12 rounded-xl text-sm font-bold ring-1 ${joursOk[k] ? "bg-emerald-700 text-white ring-transparent" : "bg-white text-stone-500 ring-stone-200"}`}>{j}</button>)}</div>
          </div>
          <div>
            <p className="mb-2 text-sm font-bold">3. Horaires de la journée <span className="font-normal text-stone-500">(1 personne par horaire)</span></p>
            <div className="space-y-2">
              {postes.map((p, k) => { const m = momentDe(p.debut); const Ico = m.ico; return (
                <div key={k} className={`flex flex-wrap items-center gap-2 rounded-2xl p-2.5 ring-1 ${m.pale}`}>
                  <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${m.cl} text-white`}><Ico size={17} /></span>
                  <span className="w-16 text-sm font-bold">{m.label}</span>
                  <input type="time" value={p.debut} onChange={(e) => setPostes(postes.map((x, i) => (i === k ? { ...x, debut: e.target.value || "08:00" } : x)))} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm" />
                  <select value={p.heures} onChange={(e) => setPostes(postes.map((x, i) => (i === k ? { ...x, heures: Number(e.target.value) } : x)))} className="rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-sm">{[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <option key={n} value={n}>{n} h</option>)}</select>
                  <span className="text-sm">→ fin <b>{h(hhmm(minutes(p.debut) + p.heures * 60))}</b></span>
                  {postes.length > 1 && <button onClick={() => setPostes(postes.filter((_, i) => i !== k))} className="ml-auto grid h-8 w-8 place-items-center rounded-lg text-stone-500 hover:bg-white" aria-label="Retirer cet horaire"><X size={15} /></button>}
                </div>
              ); })}
              {postes.length < 4 && <button onClick={() => setPostes([...postes, { debut: postes.length === 2 ? "22:00" : "11:00", heures: 7 }])} className="inline-flex items-center gap-1 rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm font-bold text-stone-600"><Plus size={14} /> Ajouter un horaire</button>}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold">4. Aperçu</p>
              <button onClick={() => setDecalage(decalage + 1)} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-bold text-stone-700"><Repeat2 size={13} /> Faire tourner</button>
            </div>
            <div className="overflow-x-auto rounded-2xl ring-1 ring-stone-200">
              <table className="w-full min-w-[560px] text-xs">
                <thead><tr className="bg-stone-50"><th className="p-2 text-left">Personne</th>{JOURS.map((j) => <th key={j} className="p-2">{j}</th>)}<th className="p-2 text-right">Total</th></tr></thead>
                <tbody>
                  {qui.map((e) => (
                    <tr key={e} className="border-t border-stone-100">
                      <td className="p-2 font-bold">{nomDe(e)}</td>
                      {jours.map((d) => { const x = plan.find((p) => p.email === e && p.jour === iso(d)); const m = x && momentDe(x.debut); return <td key={iso(d)} className="p-1 text-center">{x && m ? <span className={`inline-block rounded-lg bg-gradient-to-br ${m.cl} px-1.5 py-1 font-bold text-white`}>{h(x.debut)}</span> : <span className="text-stone-300">repos</span>}</td>; })}
                      <td className="p-2 text-right font-bold tabular-nums">{heuresDe(e)} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {qui.length < postes.length && <p className="mt-2 text-xs text-amber-700">Il y a moins de personnes que d’horaires : certains horaires resteront vides.</p>}
          </div>
          <div className="flex gap-2">
            <button disabled={!plan.length} onClick={appliquer} className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 py-3 text-sm font-extrabold text-white shadow disabled:opacity-40"><CalendarDays size={16} className="mr-1.5 inline" /> Appliquer à cette semaine ({plan.length} créneaux)</button>
            <button onClick={fermer} className="rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-600">Annuler</button>
          </div>
          <p className="text-xs text-stone-500">Les anciens créneaux de ces personnes sur cette semaine sont remplacés. Tu peux ensuite tout déplacer à la main.</p>
        </div>
      </div>
    </div>
  );
}

/** Voir son planning sur le téléphone : un lien d'agenda à ajouter une fois (Google Agenda ou iPhone) */
function AgendaTelephone({ fondateur, agents, moi }: { fondateur: boolean; agents: Agent[]; moi: string }) {
  const [lien, setLien] = useState<string | null | undefined>(undefined);
  const [liens, setLiens] = useState<Record<string, string>>({});
  const [copie, setCopie] = useState("");
  const base = typeof window !== "undefined" ? window.location.origin : "https://tontine-et-cotise.vercel.app";
  const url = (j: string) => `${base}/api/planning/agenda?j=${j}`;
  const google = (j: string) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url(j).replace(/^https?:/, "webcal:"))}`;
  const iphone = (j: string) => url(j).replace(/^https?:/, "webcal:");
  useEffect(() => { db.rpc("mon_lien_planning").then(({ data, error }) => setLien(error ? null : (data as string))); }, []);
  const lienDe = async (e: string, nouveau = false) => {
    if (nouveau && !confirm("Créer un nouveau lien ? L’ancien ne marchera plus (à faire si un téléphone est perdu).")) return null;
    const { data, error } = await db.rpc("admin_lien_planning", { adresse: e, nouveau });
    if (error) { alert(error.message); return null; }
    setLiens((x) => ({ ...x, [e]: data as string }));
    return data as string;
  };
  const copier = (t: string, quoi: string) => { navigator.clipboard?.writeText(t); setCopie(quoi); setTimeout(() => setCopie(""), 2000); };
  if (lien === null) return <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">📱 Pour voir le planning sur le téléphone (Google Agenda, iPhone), fais la <b>mise à jour SQL n°36</b> dans Supabase.</p>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 to-indigo-700 p-5 text-white shadow-lg">
        <div className="motif pointer-events-none absolute inset-0 opacity-15" />
        <div className="relative">
          <p className="flex items-center gap-2 text-lg font-extrabold"><Smartphone size={20} /> Mon planning sur mon téléphone</p>
          <p className="mt-1 text-sm text-sky-100">Ajoute ton planning une seule fois : tes horaires Cotiz apparaissent dans ton agenda, avec un rappel 30 minutes avant, et se mettent à jour tout seuls.</p>
          {lien && (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <a href={google(lien)} target="_blank" rel="noopener" className="rounded-xl bg-white px-3 py-2.5 text-center text-sm font-extrabold text-indigo-700">Google Agenda</a>
              <a href={iphone(lien)} className="rounded-xl bg-white/15 px-3 py-2.5 text-center text-sm font-bold ring-1 ring-white/30">iPhone</a>
              <button onClick={() => copier(url(lien), "moi")} className="rounded-xl bg-white/15 px-3 py-2.5 text-sm font-bold ring-1 ring-white/30">{copie === "moi" ? "Lien copié ✓" : "Copier le lien"}</button>
            </div>
          )}
          <p className="mt-3 text-xs text-sky-100">Sur Android : touche « Google Agenda » (connecte-toi avec ton compte Gmail), puis « Ajouter ». Sur iPhone : touche « iPhone », puis « S’abonner ». Le lien est personnel : ne le partage pas.</p>
        </div>
      </section>
      {fondateur && (
        <section className="rounded-3xl border border-stone-200/80 bg-white p-5 shadow-sm">
          <p className="font-extrabold">Envoyer le planning à chaque agent</p>
          <p className="text-xs text-stone-500">Chaque agent reçoit son lien personnel par WhatsApp ; il l’ajoute une fois dans l’agenda de son téléphone.</p>
          <div className="mt-3 divide-y divide-stone-100">
            {agents.filter((a) => a.email.toLowerCase() !== moi.toLowerCase()).map((a) => (
              <div key={a.email} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{a.numero ? `${a.numero} · ` : ""}{a.nom ?? a.email}</span>
                <button onClick={async () => { const j = liens[a.email] ?? await lienDe(a.email); if (!j) return; const tel = (a.telephone ?? "").replace(/\D/g, ""); const t = `Bonjour ${a.nom ?? ""}, voici ton planning Cotiz à ajouter dans l’agenda de ton téléphone :\n\nAndroid (Google Agenda) : ${google(j)}\n\niPhone : ${iphone(j)}\n\nTes horaires se mettront à jour tout seuls. Ce lien est personnel, ne le partage pas.`; window.open(`https://wa.me/${tel.length === 10 ? "225" + tel : tel}?text=${encodeURIComponent(t)}`, "_blank"); }} className="rounded-lg bg-[#1fa855] px-3 py-1.5 text-xs font-bold text-white">WhatsApp</button>
                <button onClick={async () => { const j = liens[a.email] ?? await lienDe(a.email); if (j) copier(url(j), a.email); }} className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-bold text-stone-700">{copie === a.email ? "Copié ✓" : "Copier"}</button>
                <button onClick={() => lienDe(a.email, true)} className="text-xs text-stone-400 underline">Nouveau lien</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
