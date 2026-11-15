"use client";

/** Bloc qui se déplie / se replie en douceur (pour ne pas surcharger les pages) */
import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Depliable({ titre, sousTitre, icone, badge, ouvert: ouvertInitial = false, id, children, className = "" }: {
  titre: React.ReactNode; sousTitre?: React.ReactNode; icone?: React.ReactNode; badge?: React.ReactNode; ouvert?: boolean; id?: string; children: React.ReactNode; className?: string;
}) {
  const [ouvert, setOuvert] = useState(ouvertInitial);
  return (
    <section id={id} className={`carte scroll-mt-20 overflow-hidden transition-shadow duration-300 ${ouvert ? "shadow-[0_12px_30px_-18px_rgba(11,61,44,0.35)]" : ""} ${className}`}>
      <button type="button" onClick={() => setOuvert(!ouvert)} aria-expanded={ouvert} className="flex w-full items-center gap-3 p-4 text-left">
        {icone}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2 font-bold text-stone-900">{titre}{badge}</span>
          {sousTitre && <span className="mt-0.5 block text-xs leading-snug text-stone-500">{sousTitre}</span>}
        </span>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition-all duration-300 ${ouvert ? "rotate-180 bg-emerald-700 text-white" : "bg-stone-100 text-stone-600"}`}><ChevronDown size={17} /></span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${ouvert ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className={`px-4 pb-4 transition-opacity duration-300 ${ouvert ? "opacity-100" : "opacity-0"}`}>{children}</div>
        </div>
      </div>
    </section>
  );
}
