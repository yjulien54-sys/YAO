"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { supabase } from "./supabase";
import { useStore } from "./store";
import { vibrer } from "./haptique";

/** « 10000 F » → « 10 000 F » dans les textes de notifications */
export const montantsLisibles = (t: string | null) => (t ?? "").replace(/\d{4,}(?= F)/g, (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, " "));

export type Notif = { id: number; type: string; titre: string; texte: string | null; lien: string | null; lue: boolean; le: string };

type Ctx = { liste: Notif[]; nonLues: number; dispo: boolean; marquerLue: (id: number) => Promise<void>; marquerToutLu: () => Promise<void> };
const NotifCtx = createContext<Ctx>({ liste: [], nonLues: 0, dispo: false, marquerLue: async () => {}, marquerToutLu: async () => {} });
export const useNotifications = () => useContext(NotifCtx);

/** Notifications de l'application (mise à jour SQL n°13) : liste, compteur et alerte en direct */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { userId, reload } = useStore();
  const router = useRouter();
  const [liste, setListe] = useState<Notif[]>([]);
  const [dispo, setDispo] = useState(false);
  const [alerte, setAlerte] = useState<Notif | null>(null);

  useEffect(() => {
    if (!userId) {
      setListe([]);
      return;
    }
    let actif = true;
    supabase
      .from("notifications")
      .select("id, type, titre, texte, lien, lue, le")
      .order("le", { ascending: false })
      .limit(60)
      .then(({ data, error }) => {
        if (!actif) return;
        setDispo(!error);
        if (!error && data) setListe(data as Notif[]);
      });
    // En direct : une nouvelle notification arrive
    const canal = supabase
      .channel(`notifs-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `profile_id=eq.${userId}` }, (p) => {
        const n = p.new as Notif;
        setListe((l) => [n, ...l.filter((x) => x.id !== n.id)].slice(0, 60));
        setAlerte(n);
        vibrer("ok");
        reload();
      })
      .subscribe();
    return () => {
      actif = false;
      supabase.removeChannel(canal);
    };
  }, [userId, reload]);

  // L'alerte disparaît toute seule après quelques secondes
  useEffect(() => {
    if (!alerte) return;
    const t = setTimeout(() => setAlerte(null), 6000);
    return () => clearTimeout(t);
  }, [alerte]);

  const marquerLue = useCallback(async (id: number) => {
    setListe((l) => l.map((n) => (n.id === id ? { ...n, lue: true } : n)));
    await supabase.from("notifications").update({ lue: true }).eq("id", id);
  }, []);

  const marquerToutLu = useCallback(async () => {
    setListe((l) => l.map((n) => ({ ...n, lue: true })));
    await supabase.from("notifications").update({ lue: true }).eq("lue", false);
  }, []);

  const nonLues = liste.filter((n) => !n.lue).length;

  return (
    <NotifCtx.Provider value={{ liste, nonLues, dispo, marquerLue, marquerToutLu }}>
      {children}
      {alerte && (
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3">
          <div className="notif-entre pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-stone-200">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-3 text-left"
              onClick={() => {
                marquerLue(alerte.id);
                if (alerte.lien) router.push(alerte.lien);
                setAlerte(null);
              }}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Bell size={19} strokeWidth={2} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-stone-900">{alerte.titre}</span>
                {alerte.texte && <span className="block text-[0.8125rem] leading-snug text-stone-600">{montantsLisibles(alerte.texte)}</span>}
              </span>
            </button>
            <button type="button" onClick={() => setAlerte(null)} aria-label="Fermer" className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-stone-400 hover:bg-stone-100">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
    </NotifCtx.Provider>
  );
}
