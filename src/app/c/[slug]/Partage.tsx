"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

/** Partager la cagnotte : WhatsApp en priorité, sinon le partage du téléphone ou la copie du lien */
export function Partage({ texte, lien }: { texte: string; lien: string }) {
  const [copie, setCopie] = useState(false);
  return (
    <div className="flex gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(texte)}`} target="_blank" rel="noopener" className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-[#1fa855] text-white shadow" aria-label="Partager sur WhatsApp">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>
      </a>
      <button type="button" onClick={async () => {
        try { if (navigator.share) { await navigator.share({ title: "Cagnotte Cotiz", text: texte, url: lien }); return; } } catch { return; }
        navigator.clipboard?.writeText(lien); setCopie(true); setTimeout(() => setCopie(false), 2000);
      }} className="grid h-[52px] min-w-[52px] place-items-center rounded-2xl bg-stone-100 px-3 text-stone-700" aria-label="Partager le lien">
        {copie ? <span className="text-xs font-bold">Copié ✓</span> : <Share2 size={20} />}
      </button>
    </div>
  );
}
