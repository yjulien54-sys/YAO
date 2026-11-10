import { Headset, Phone } from "lucide-react";
import { IconBadge } from "./icons";
import { SUPPORT_AFFICHE, SUPPORT_PHONE } from "@/lib/support";
import { WhatsAppIcon } from "./ui";

const wa = (texte: string) => `https://wa.me/225${SUPPORT_PHONE}?text=${encodeURIComponent(texte)}`;

/** Carte « Service client » : WhatsApp et appel */
export function ServiceClient({ sujet = "Bonjour, j’ai besoin d’aide avec Cotiz." }: { sujet?: string }) {
  return (
    <div className="carte space-y-3 p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={Headset} />
        <div>
          <p className="font-bold">Service client Cotiz</p>
          <p className="text-xs text-stone-500">Une question, un problème ? On t’aide. · {SUPPORT_AFFICHE}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={wa(sujet)} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#1fa855] px-3 py-3 text-sm font-bold text-white hover:bg-[#178f47]">
          <WhatsAppIcon size={18} /> Écrire
        </a>
        <a href={`tel:${SUPPORT_PHONE}`} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-3 py-3 text-sm font-bold text-stone-800 shadow-sm ring-1 ring-stone-200">
          <Phone size={17} strokeWidth={1.9} /> Appeler
        </a>
      </div>
    </div>
  );
}

/** Petit lien « Besoin d'aide ? » */
export function LienAide({ sujet }: { sujet: string }) {
  return (
    <a href={wa(sujet)} target="_blank" rel="noreferrer" className="block text-center text-xs font-semibold text-emerald-700 underline">
      Besoin d’aide ? Contacter le service client
    </a>
  );
}
