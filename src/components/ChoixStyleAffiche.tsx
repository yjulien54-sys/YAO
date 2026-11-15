"use client";

/** Le trésorier choisit le style des affiches du groupe (lien de cagnotte et invitation) */
import { useState } from "react";
import { Check, Loader2, Palette } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { THEMES, themePour } from "@/lib/themesAffiche";

export function ChoixStyleAffiche({ groupId, theme, apresChangement }: { groupId: string; theme: number | null | undefined; apresChangement?: () => void }) {
  const [choix, setChoix] = useState<number | null>(theme ?? null);
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState("");
  const actuel = themePour(groupId, choix);

  const choisir = async (t: number) => {
    setOccupe(true); setMsg("");
    const { error } = await supabase.rpc("groupe_theme", { g: groupId, t });
    setOccupe(false);
    if (error) return setMsg(error.message.includes("function") ? "Mise à jour n°42 à faire dans Supabase." : "Erreur : " + error.message);
    setChoix(t);
    setMsg(`Style « ${THEMES[t].nom} » enregistré : toutes les affiches du groupe l’utilisent.`);
    apresChangement?.();
    // La cagnotte publique (s'il y en a une) refait son affiche
    const { data } = await supabase.rpc("cagnotte_etat", { g: groupId });
    const slug = (data as { slug?: string | null; actif?: boolean } | null);
    if (slug?.actif && slug.slug) fetch("/api/cagnotte/affiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: slug.slug }) }).catch(() => {});
  };

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm font-bold"><Palette size={17} className="text-[#f77f00]" /> Style des affiches du groupe {occupe && <Loader2 size={14} className="animate-spin text-stone-400" />}</p>
      <p className="-mt-2 text-xs text-stone-500">L’image qui apparaît quand vous partagez le lien du groupe ou de la cagnotte sur WhatsApp.</p>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
        {THEMES.map((t, k) => (
          <button key={t.nom} type="button" disabled={occupe} onClick={() => choisir(k)}
            className={`group relative overflow-hidden rounded-2xl p-1 transition ${actuel === k ? "ring-[3px] ring-emerald-600" : "ring-1 ring-stone-200 hover:ring-stone-300"}`}>
            <span className="relative flex h-16 flex-col justify-between rounded-xl p-2 text-left" style={{ background: t.pastille }}>
              <span className="h-1.5 w-8 rounded-full" style={{ background: t.accent }} />
              <span className="flex items-end justify-between">
                <span className="h-2.5 w-10 rounded-full" style={{ background: t.bouton }} />
                <span className="flex h-2 w-10 overflow-hidden rounded-full">{t.motif.slice(0, 4).map((c, i) => <span key={i} className="flex-1" style={{ background: c }} />)}</span>
              </span>
              {actuel === k && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-white text-emerald-700 shadow"><Check size={12} strokeWidth={3} /></span>}
            </span>
            <span className={`mt-1 block text-center text-[0.7rem] font-bold ${actuel === k ? "text-emerald-800" : "text-stone-600"}`}>{t.nom}{choix == null && actuel === k ? " · auto" : ""}</span>
          </button>
        ))}
      </div>
      {msg && <p className={`text-xs font-medium ${msg.startsWith("Erreur") || msg.includes("n°42") ? "text-red-600" : "text-emerald-700"}`}>{msg}</p>}
    </div>
  );
}
