"use client";

import { useCallback, useEffect, useState } from "react";
import { EVENEMENT_LABEL, contexte, messageModele, type TypeMessage } from "@/lib/messages";
import { supabase } from "@/lib/supabase";
import type { Group, Member } from "@/lib/types";
import { waLink } from "@/lib/whatsapp";
import { WhatsAppIcon, btnClass } from "./ui";

const MOMENT_LABEL = { avance: "Bien avant l’échéance", bientot: "Échéance proche", jour: "Jour J", retard: "En retard" };

export function MessageModal({ group, member, type, onClose }: { group: Group; member?: Member; type: TypeMessage; onClose: () => void }) {
  const ctx = contexte(group, type, typeof window !== "undefined" ? window.location.origin : "", member);
  const [texte, setTexte] = useState(() => messageModele(ctx));
  const [source, setSource] = useState<"modele" | "ia" | "chargement">("chargement");
  const ctxKey = JSON.stringify(ctx);

  const generer = useCallback(async () => {
    setSource("chargement");
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: ctxKey.length ? JSON.stringify({ contexte: JSON.parse(ctxKey) }) : "{}",
      });
      const json = await res.json();
      if (json.texte) setTexte(json.texte);
      setSource(json.source === "ia" ? "ia" : "modele");
    } catch {
      setSource("modele");
    }
  }, [ctxKey]);

  useEffect(() => {
    generer();
  }, [generer]);

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-4 shadow-xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{type === "groupe" ? "Message pour le groupe" : `Message pour ${member?.name}`}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{EVENEMENT_LABEL[ctx.evenement]}</span>
              {group.type !== "collecte" && <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-600">{MOMENT_LABEL[ctx.moment]}</span>}
              {source === "ia" && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-700">✨ Écrit par l’IA</span>}
              {source === "chargement" && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">✨ L’IA écrit…</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="rounded-full p-1 text-xl leading-none text-stone-400 hover:bg-stone-100">×</button>
        </div>
        <textarea
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          rows={10}
          className="w-full rounded-xl border border-stone-300 bg-stone-50 p-3 text-sm leading-relaxed outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <p className="mb-3 mt-1 text-xs text-stone-500">Tu peux modifier le texte avant de l’envoyer.</p>
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <button onClick={generer} disabled={source === "chargement"} className={btnClass("secondary", "!px-3")} title="Proposer un autre message">
            ✨ Autre version
          </button>
          <a href={waLink(texte, member?.phone)} target="_blank" rel="noreferrer" onClick={onClose} className={btnClass("whatsapp")}>
            <WhatsAppIcon /> Envoyer sur WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
