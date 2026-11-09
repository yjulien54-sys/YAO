"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, Gift, Repeat } from "lucide-react";
import { IconBadge } from "./icons";
import { prenom } from "@/lib/format";

const CLE = "cotiz:bienvenue-vue";

const Drapeau = () => (
  <span className="inline-flex h-3 w-[18px] overflow-hidden rounded-[2px] ring-1 ring-black/10" aria-hidden>
    <span className="flex-1 bg-[#f77f00]" />
    <span className="flex-1 bg-white" />
    <span className="flex-1 bg-[#009e60]" />
  </span>
);

/** Écran d'accueil affiché à l'ouverture de l'application (une fois par session) */
export function Bienvenue({ nom }: { nom: string }) {
  const [visible, setVisible] = useState(false);
  const [sortie, setSortie] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(CLE)) return;
      sessionStorage.setItem(CLE, "1");
    } catch {}
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => fermer(), 4000);
    return () => clearTimeout(t);
  }, [visible]);

  function fermer() {
    setSortie(true);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;
  return (
    <div className={`fixed inset-0 z-50 mx-auto max-w-md overflow-hidden transition-opacity duration-300 lg:grid lg:max-w-none lg:place-items-center lg:bg-stone-900/50 lg:backdrop-blur-sm ${sortie ? "opacity-0" : "opacity-100"}`}>
      <section className="degrade-vert relative flex h-full flex-col px-6 pb-8 pt-10 text-white lg:h-auto lg:max-h-[92vh] lg:w-[460px] lg:overflow-hidden lg:rounded-[2rem] lg:shadow-2xl">
        <div className="motif absolute inset-0" />
        <div className="bande-kente absolute inset-x-0 top-0" />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/logo.svg" alt="" width={40} height={40} className="h-10 w-10 rounded-xl shadow-md" />
            Cotiz
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/20">
            <Drapeau /> Côte d’Ivoire
          </span>
        </div>

        <h1 className="relative mt-10 text-[2rem] font-extrabold leading-[1.1] tracking-tight">
          Tes tontines et cotisations, <span className="text-orange-300">sans palabres.</span>
        </h1>
        <p className="relative mt-3 text-base leading-relaxed text-emerald-50/90">Tontines, associations, collectes : tout le monde voit qui a payé.</p>

        <div className="flotte relative mx-auto mt-8 w-[88%] rounded-3xl bg-white p-4 text-stone-900 shadow-2xl shadow-emerald-950/40">
          <div className="flex items-center gap-3">
            <IconBadge icon={Repeat} ton="orange" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">Tontine des commerçantes</p>
              <p className="inline-flex items-center gap-1 text-xs text-stone-500">Tour 3 sur 10 · <Gift size={12} strokeWidth={1.75} /> Awa reçoit</p>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-xl font-extrabold">400 000 F</span>
            <span className="text-xs text-stone-500">sur 500 000 F</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-stone-200">
            <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-orange-300 to-orange-500" />
          </div>
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check size={14} strokeWidth={2.25} /> 8 ont payé</p>
        </div>

        <div className="relative mt-auto space-y-3 pt-8">
          <p className="text-center text-lg font-bold">Bonjour {prenom(nom)} 👋</p>
          <button onClick={fermer} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-base font-extrabold text-emerald-800 shadow-lg">
            Entrer <ArrowRight size={20} strokeWidth={2.25} />
          </button>
        </div>
      </section>
    </div>
  );
}
