"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { fraisPour, lirePourcent, lireTranches, type Tranche } from "./fraisService";

/** Réglage « Caisse Cotiz » (mise à jour SQL n°19) : les membres paient par Wave sur le compte marchand de Cotiz */
export type CaisseCotiz = { actif: boolean; lien: string | null; nom: string };

let cache: CaisseCotiz | null = null;

export function useCaisseCotiz() {
  const [c, setC] = useState<CaisseCotiz | null>(cache);
  useEffect(() => {
    if (cache) return;
    supabase.from("parametres_app").select("cle, valeur").then(({ data, error }) => {
      if (error || !data) return setC((cache = { actif: false, lien: null, nom: "Cotiz" }));
      const v = Object.fromEntries(data.map((r: { cle: string; valeur: string | null }) => [r.cle, r.valeur]));
      const lien = v.caisse_cotiz_lien ?? null;
      setC((cache = { actif: v.caisse_cotiz_actif === "oui" && !!lien, lien, nom: v.caisse_cotiz_nom || "Cotiz" }));
    });
  }, []);
  return c;
}

/** Ajoute le montant quand le lien Wave le permet (pay.wave.com) */
/** Frais de service Cotiz (mise à jour SQL n°23) : affichés au membre avant un paiement en ligne */
let cacheFrais: { actif: boolean; tranches: Tranche[]; pourcent: number } | null = null;
export function useFraisService() {
  const [f, setF] = useState(cacheFrais);
  useEffect(() => {
    if (cacheFrais) return;
    supabase.from("parametres_app").select("cle, valeur").like("cle", "frais_service_%").then(({ data, error }) => {
      const v = Object.fromEntries(((error ? [] : data) ?? []).map((r: { cle: string; valeur: string | null }) => [r.cle, r.valeur]));
      setF((cacheFrais = { actif: !error && (data?.length ?? 0) > 0 && v.frais_service_actif !== "non", tranches: lireTranches(v.frais_service_tranches), pourcent: lirePourcent(v.frais_service_pourcent) }));
    });
  }, []);
  return { actif: !!f?.actif, frais: (montant: number) => (f?.actif ? fraisPour(montant, f.tranches, f.pourcent) : 0) };
}

export function lienCaisse(lien: string, montant: number) {
  if (!/^https:\/\/pay\.wave\.com\//i.test(lien)) return lien;
  const u = new URL(lien);
  u.searchParams.set("amount", String(Math.round(montant)));
  return u.toString();
}
