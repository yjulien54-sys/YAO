"use client";

import { Ban, Headset } from "lucide-react";
import { useStore } from "@/lib/store";
import { SUPPORT_PHONE } from "@/lib/support";
import { waLink } from "@/lib/whatsapp";

/** Écran affiché à une personne dont le compte a été bloqué par l'administrateur */
export function CompteBloque() {
  const { bloque, user } = useStore();
  if (!bloque) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-stone-900/90 p-6 text-center">
      <div className="w-full max-w-sm space-y-4 rounded-[28px] bg-white p-6">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-50 text-red-600"><Ban size={28} strokeWidth={2} /></span>
        <p className="text-xl font-extrabold text-stone-900">Compte bloqué</p>
        <p className="text-sm text-stone-600">Ton compte Cotiz a été bloqué par l’équipe Cotiz. Tu ne peux plus accéder aux groupes.</p>
        {bloque.motif && <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">Motif : <b>{bloque.motif}</b></p>}
        <a
          href={waLink(`Bonjour, mon compte Cotiz (${user?.phone ?? ""}) a été bloqué. Pouvez-vous m’expliquer ?`, SUPPORT_PHONE)}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-[14px] bg-emerald-700 py-3.5 text-sm font-bold text-white"
        >
          <Headset size={18} /> Contacter le service client
        </a>
      </div>
    </div>
  );
}
