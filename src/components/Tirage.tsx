"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Dices, Trophy } from "lucide-react";
import { IconBadge } from "./icons";
import { Button, inputClass } from "./ui";
import { dateLongue } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { Group } from "@/lib/types";

/** Carte du tirage au sort public de l'ordre de passage (tontine) */
export function Tirage({ g, tresorier, onVoirOrdre }: { g: Group; tresorier: boolean; onVoirOrdre: () => void }) {
  const { setTiragePrevu, lancerTirage } = useStore();
  const [date, setDate] = useState(g.tiragePrevu ? g.tiragePrevu.slice(0, 16) : "");
  const [anim, setAnim] = useState<{ phase: "melange" | "resultat"; noms: string[] } | null>(null);
  const [erreur, setErreur] = useState("");
  const [busy, setBusy] = useState(false);

  if (g.type !== "tontine") return null;
  const noms = (ids: string[]) => ids.map((id) => g.members.find((m) => m.id === id)?.name ?? "—");
  const avantDate = g.tiragePrevu && new Date(g.tiragePrevu).getTime() > Date.now();

  const modale = anim && <AnimationTirage anim={anim} onFermer={() => setAnim(null)} />;

  // Résultat déjà connu : visible par tous
  if (g.tirageFait)
    return (
      <>
      {modale}
      <div className="carte space-y-3 p-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={Trophy} ton="vert" />
          <div className="min-w-0">
            <p className="font-bold">Tirage au sort effectué</p>
            <p className="text-xs text-stone-500">
              Le {dateLongue(g.tirageFait)} par {g.tiragePar ?? "le trésorier"}
            </p>
          </div>
        </div>
        <ol className="space-y-1">
          {noms(g.order).slice(0, 3).map((n, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{i + 1}</span>
              {n}
            </li>
          ))}
        </ol>
        <button onClick={onVoirOrdre} className="text-sm font-semibold text-emerald-700 underline">Voir tout l’ordre de passage</button>
      </div>
      </>
    );

  if (!tresorier && !g.tiragePrevu) return null;

  return (
    <>
      <div className="carte space-y-3 p-4">
        <div className="flex items-start gap-3">
          <IconBadge icon={Dices} ton="orange" />
          <div className="min-w-0">
            <p className="font-bold">Tirage au sort de l’ordre</p>
            <p className="text-xs text-stone-500">
              {g.tiragePrevu
                ? `Prévu le ${dateLongue(g.tiragePrevu)}. Tout le monde verra le résultat, avec la date et l’heure du tirage.`
                : "Programme une date : tous les membres la verront, puis le résultat du tirage."}
            </p>
          </div>
        </div>

        {tresorier && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input type="datetime-local" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date du tirage" />
              <Button
                variant="secondary"
                className="shrink-0 !px-3"
                disabled={busy || !date}
                onClick={async () => {
                  setBusy(true);
                  setErreur("");
                  try {
                    await setTiragePrevu(g.id, date);
                  } catch (e) {
                    setErreur((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <CalendarClock size={16} /> Programmer
              </Button>
            </div>
            <Button
              className="w-full"
              disabled={busy}
              onClick={async () => {
                if (avantDate && !confirm("La date prévue n’est pas encore arrivée. Lancer le tirage maintenant ?")) return;
                if (!confirm("Le tirage ne peut être fait qu’une seule fois. Lancer le tirage au sort ?")) return;
                setBusy(true);
                setErreur("");
                setAnim({ phase: "melange", noms: g.members.map((m) => m.name) });
                try {
                  const ids = await lancerTirage(g.id);
                  setTimeout(() => setAnim({ phase: "resultat", noms: noms(ids) }), 2200);
                } catch (e) {
                  setAnim(null);
                  setErreur((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Dices size={18} /> Lancer le tirage au sort
            </Button>
          </div>
        )}
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
      </div>

      {modale}
    </>
  );
}

function AnimationTirage({ anim, onFermer }: { anim: { phase: "melange" | "resultat"; noms: string[] }; onFermer: () => void }) {
  const [affiche, setAffiche] = useState(anim.noms[0] ?? "");
  const [revele, setRevele] = useState(0);

  useEffect(() => {
    if (anim.phase !== "melange") return;
    const t = setInterval(() => setAffiche(anim.noms[Math.floor(Math.random() * anim.noms.length)]), 90);
    return () => clearInterval(t);
  }, [anim]);

  useEffect(() => {
    if (anim.phase !== "resultat") return;
    setRevele(0);
    const t = setInterval(() => setRevele((r) => (r >= anim.noms.length ? r : r + 1)), 450);
    return () => clearInterval(t);
  }, [anim]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl">
        {anim.phase === "melange" ? (
          <>
            <IconBadge icon={Dices} ton="orange" taille="xl" className="mx-auto animate-bounce" />
            <p className="mt-4 text-sm text-stone-500">Tirage en cours…</p>
            <p className="mt-2 text-2xl font-extrabold tracking-tight">{affiche}</p>
          </>
        ) : (
          <>
            <IconBadge icon={Trophy} taille="xl" className="mx-auto" />
            <p className="mt-3 text-lg font-extrabold">Résultat du tirage</p>
            <ol className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto text-left">
              {anim.noms.map((n, i) => (
                <li key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-300 ${i < revele ? "bg-emerald-50 opacity-100" : "translate-y-1 opacity-0"}`}>
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{i + 1}</span>
                  <span className="font-semibold">{n}</span>
                  {i === 0 && <span className="ml-auto text-[11px] font-bold text-emerald-700">reçoit en 1er</span>}
                </li>
              ))}
            </ol>
            <Button className="mt-4 w-full" onClick={onFermer}>Fermer</Button>
          </>
        )}
      </div>
    </div>
  );
}
