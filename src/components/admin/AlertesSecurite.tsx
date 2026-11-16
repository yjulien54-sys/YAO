"use client";

/**
 * Admin (fondateur uniquement) : activités suspectes repérées par le serveur
 * (trop de demandes, codes faux répétés, signature de paiement invalide, montant payé incorrect…).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabaseAdmin as db } from "@/lib/supabaseAdmin";

type Alerte = { id: number; type: string; detail: string | null; ip: string | null; profile_id: string | null; nom: string | null; cree_le: string };

const LIBELLE: Record<string, [string, string]> = {
  limite_depassee: ["Trop de demandes", "bg-amber-100 text-amber-800"],
  compte_bloque: ["Codes faux répétés", "bg-rose-100 text-rose-800"],
  webhook_signature_fausse: ["Faux appel de paiement", "bg-rose-100 text-rose-800"],
  paiement_montant_incorrect: ["Montant payé incorrect", "bg-red-600 text-white"],
  admin_refuse: ["Accès admin refusé", "bg-violet-100 text-violet-800"],
};
const quand = (iso: string) => new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function AlertesSecurite() {
  const [liste, setListe] = useState<Alerte[] | null>(null);
  const [erreur, setErreur] = useState("");
  const charger = useCallback(async () => {
    setErreur("");
    const { data, error } = await db.rpc("admin_alertes", { nb: 200 });
    if (error) return setErreur(error.message.includes("fondateur") ? "Réservé au fondateur." : "Mise à jour SQL n°46 à faire dans Supabase.");
    setListe((data as Alerte[]) ?? []);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const jour = useMemo(() => (liste ?? []).filter((a) => Date.now() - new Date(a.cree_le).getTime() < 86_400_000).length, [liste]);
  const graves = useMemo(() => (liste ?? []).filter((a) => a.type === "paiement_montant_incorrect" || a.type === "webhook_signature_fausse").length, [liste]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold"><ShieldAlert size={20} className="text-rose-600" /> Sécurité</h2>
          <p className="text-sm text-stone-500">Activités suspectes repérées automatiquement (les 90 derniers jours).</p>
        </div>
        <button onClick={charger} className="inline-flex items-center gap-1.5 rounded-xl bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700"><RefreshCw size={15} /> Actualiser</button>
      </div>
      {erreur && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">{erreur}</p>}
      {liste && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200"><p className="text-xs text-stone-500">Dernières 24 h</p><p className="text-2xl font-extrabold">{jour}</p></div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200"><p className="text-xs text-stone-500">Graves</p><p className={`text-2xl font-extrabold ${graves ? "text-red-600" : ""}`}>{graves}</p></div>
          <div className="rounded-2xl bg-white p-3 ring-1 ring-stone-200"><p className="text-xs text-stone-500">Total</p><p className="text-2xl font-extrabold">{liste.length}</p></div>
        </div>
      )}
      {liste && !liste.length && (
        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800"><ShieldCheck size={18} /> Aucune activité suspecte. Tout est calme.</p>
      )}
      <div className="divide-y divide-stone-100 rounded-2xl bg-white ring-1 ring-stone-200">
        {(liste ?? []).map((a) => {
          const [lib, cls] = LIBELLE[a.type] ?? [a.type, "bg-stone-100 text-stone-700"];
          return (
            <div key={a.id} className="space-y-1 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{lib}</span>
                <span className="text-xs text-stone-400">{quand(a.cree_le)}</span>
                {a.ip && <span className="text-xs tabular-nums text-stone-400">IP {a.ip}</span>}
                {a.nom && <span className="text-xs font-semibold text-stone-600">{a.nom}</span>}
              </div>
              {a.detail && <p className="text-sm text-stone-700">{a.detail}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
