"use client";

/** Nouveaux messages de discussion, par groupe (pour la pastille sur « Mes groupes ») */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type NonLus = Record<string, { nb: number; prives: number }>;

export function useNonLus(userId: string | null | undefined) {
  const [nonLus, setNonLus] = useState<NonLus>({});
  const charger = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("mes_messages_non_lus");
    if (error) return; // mise à jour SQL n°43 pas encore faite
    const m: NonLus = {};
    for (const r of (data as { group_id: string; nb: number; prives: number }[]) ?? []) m[r.group_id] = { nb: r.nb, prives: r.prives };
    setNonLus(m);
  }, [userId]);
  useEffect(() => {
    charger();
    if (!userId) return;
    const canal = supabase.channel(`non-lus-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages_groupe" }, () => charger())
      .subscribe();
    const f = () => charger();
    window.addEventListener("focus", f);
    return () => { supabase.removeChannel(canal); window.removeEventListener("focus", f); };
  }, [userId, charger]);
  return { nonLus, recharger: charger };
}

/** Je viens d'ouvrir la discussion : les messages sont lus */
export const marquerDiscussionLue = (groupId: string) => supabase.rpc("discussion_lue", { g: groupId }).then(() => {}, () => {});
