"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { lienFrais } from "@/lib/motif";

const LogoWhatsApp = ({ size = 20 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z" /></svg>
);

/** Partager la cagnotte : WhatsApp, ou copie du lien. « large » = deux boutons pleine largeur (carte) */
export function Partage({ texte, lien, large = false }: { texte: string; lien: string; large?: boolean }) {
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try { await navigator.clipboard.writeText(lienFrais(lien)); } catch { /* ancien navigateur */ }
    setCopie(true); setTimeout(() => setCopie(false), 2000);
  };
  const wa = `https://wa.me/?text=${encodeURIComponent(texte)}`;
  if (large) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <a href={wa} target="_blank" rel="noopener" className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-3 text-sm font-semibold text-stone-800 transition hover:border-[#25d366] hover:text-[#128c4a]"><span className="text-[#25d366]"><LogoWhatsApp size={18} /></span> WhatsApp</a>
        <button type="button" onClick={copier} className="flex items-center justify-center gap-2 rounded-full border border-black/10 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-400">{copie ? <><Check size={16} className="text-[#009e60]" /> Lien copié</> : <><Link2 size={16} /> Copier le lien</>}</button>
      </div>
    );
  }
  return (
    <a href={wa} target="_blank" rel="noopener" className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-black/10 text-[#25d366]" aria-label="Partager sur WhatsApp"><LogoWhatsApp size={22} /></a>
  );
}
